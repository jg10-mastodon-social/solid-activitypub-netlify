# solid-activitypub-netlify

![No maintenance intended](https://img.shields.io/badge/no_maintenance_intended-orange) ![Code quality: TDD vibe coded](https://img.shields.io/badge/code_quality-TDD_vibe_coded-orange)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jg10-mastodon-social/solid-activitypub-netlify#WHITELISTED_ISSUERS=&SOLID_STORAGE_BASE_URL=)

ActivityPub server using Netlify Functions and Edge Functions, with collections stored on a Solid pod and actor identity in Netlify Blobs.

- **Outbox** (POST): Solid-OIDC-authenticated. Normalizes the activity, distributes it to explicit recipients via HTTP-signed POSTs, fans out to followers for public posts, and persists to a paged outbox on the pod.
- **Inbox** (POST): Validates `@context` and binds the authenticated key to `actor`. Sends a signed `Accept` for `Follow` and adds the follower; handles `Undo` `Follow`; persists other activities to a paged inbox.
- **Shared Inbox** (POST `/inbox`): advertised as `endpoints.sharedInbox` on every actor's AS2 document so remote servers can collapse per-follower deliveries into one POST per origin server. See *Inbox POST* below.
- **WebFinger** (GET `/.well-known/webfinger`): served by a Netlify Edge Function backed by the runtime actor registry, so actors become discoverable as soon as they are created.
- **GET**: proxies the paged collection (DPoP-authenticated for the Inbox; unauthenticated for the Outbox — both rewrite pod URLs to the public base URL).
- **Signatures**: a separate RSA actor key signs outgoing requests and is published in the AS2 actor document for recipients to verify.

## Prerequisites

- Node.js 18+
- [netlify-cli](https://docs.netlify.com/cli/get-started/) for local development (`npm install -g netlify-cli`)

## Setup

```bash
npm install

netlify build --context=dev
```

Build time generates the service identity:
- `src/base-url.ts` - site URL (gitignored)
- `src/private-key.ts` - OIDC ES256 signing key (gitignored)
- `public/webid`, `public/jwks.json`, `public/.well-known/openid-configuration` - OIDC identity files

Actor identity (per-actor RSA keys and WebFinger records) is not generated at build time; it lives in Netlify Blobs and is managed through the admin API. See *Adding actors at runtime* and *Migration and backup*.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHITELISTED_ISSUERS` | Yes | Comma-separated list of trusted OIDC issuers |
| `SOLID_STORAGE_BASE_URL` | Yes | Base URL of the Solid pod (must end with `/`) |
| `WEBID` | No | Solid WebID (default: `${BASE_URL}/webid`) |
| `ISSUER` | No | OIDC issuer (default: `${BASE_URL}`) |
| `SEND_TO_URL` | No | URL the outbox DPoP token is bound to (default: `${BASE_URL}/outbox`) |
| `ADMIN_WEBID` | No | WebID allowed to call the actor admin API. The admin API is disabled when unset. |
| `ACTOR_KEY_ENCRYPTION_KEY` | Yes | Base64 32-byte key used to envelope-encrypt actor private JWKs before they are stored in Blobs. |
| `ACTOR_REGISTRY_STORE` | No | Blobs store holding the authoritative actor records (default: `actor-registry`). |
| `ACTOR_SECRET_STORE` | No | Blobs store holding envelope-encrypted actor private keys (default: `actor-secrets`). |
| `JWKS` | No | Existing OIDC JWK (JSON) to reuse instead of generating a new keypair |

Runtime variables are frozen per deploy. Set them in the Netlify UI, CLI, or API. `netlify.toml` values are not exposed to functions at runtime.

## Migration and backup

`scripts/actors-backup.ts` manages the offline registry and secret stores. It drives the authenticated Netlify CLI (`netlify blobs:get` / `netlify blobs:set`), so no Blobs credentials live in the application, and it uses the same envelope encryption as the runtime.

```bash
node scripts/actors-backup.ts backup <dir>                 # export both stores to snapshots
node scripts/actors-backup.ts restore <dir>                # restore both stores from snapshots
node scripts/actors-backup.ts restore --from-actor-keys    # seed from a saved src/actor-keys.ts
```

`restore --from-actor-keys` reads each actor name and private JWK from a saved copy of the build-time `src/actor-keys.ts`, encrypts the JWK with `ACTOR_KEY_ENCRYPTION_KEY`, and writes the registry and secret records. It is the one-time migration and is idempotent, so there is no separate migration script. Secret snapshots contain only envelope-encrypted keys; restoring them also requires the same `ACTOR_KEY_ENCRYPTION_KEY`.

## How it works

Each actor in the runtime registry gets its own RSA signing key, its own outbox/inbox/followers collection on the pod, its own per-actor endpoints, and its own AS2 actor document served by the `actor-router` function (overlay-merged with a profile from the pod on every request). A single server-wide `/inbox` (the shared inbox) is also exposed and advertised on every actor's AS2 document as `endpoints.sharedInbox`.

Every request handled by the actor-router function logs a single `[router] METHOD /path` entry line at the start (e.g. `[router] POST /alice/outbox`), followed by any of the auth-failure / delivery-summary logs documented on each endpoint below. Grepping for `[router]` is the fastest way to follow a single request through the function.

### Outbox POST `/${actorName}/outbox`

One route per registered actor, e.g. `/alice/outbox`. Solid-OIDC-authenticated. The handler ignores any sub-path — paging is managed internally.

1. Resolve `actorName` from the path; reject 404 if not a registered actor.
2. Verify the DPoP token via `verifyDpopToken` (using `@solid/access-token-verifier`); reject with 401/403 on failure or if the token's issuer is not in `WHITELISTED_ISSUERS`. **Debugging:** a DPoP failure logs `[router] POST /${actorName}/outbox auth failed: <reason>` — grep this to distinguish a missing header, an issuer not in `WHITELISTED_ISSUERS`, or a token-verification failure (bad signature, expired token, clock skew).
3. Parse the body as JSON; reject 400 on parse error.
4. Validate `@context` and that `activity.actor` equals `${BASE_URL}/${actorName}`; reject 400/403 on failure.
5. Normalize the activity: assign `id` and `published` if missing.
6. Resolve explicit recipients from `to`/`cc`/`bto`/`bcc`/`audience`, look up each recipient's `inbox` via their actor document, and POST the activity there with an HTTP signature (`RSA-SHA256`, signed with this actor's key from the `actor-secrets` Blobs store). **Debugging:** a delivery summary logs `[router] POST /${actorName}/outbox delivered to X/Y recipients` — grep this to see the delivery count without parsing the JSON response body.
7. If the activity is public, load the followers collection at `${SOLID_STORAGE_BASE_URL}${actorName}/followers/` and POST the activity to every follower not already in the explicit-recipient set.
8. For `Undo Follow` specifically: remove the `object.object` (the formerly-followed actor URI) from `${SOLID_STORAGE_BASE_URL}${actorName}/following/`, decrementing `as:totalItems` on the collection root via `solid:InsertDeletePatch` (mirror of the followers decrement). Failure to update the collection is non-fatal — log a warning and continue so the outbox POST still returns 200 with its delivery summary.
9. Derive the next paged-outbox slot under `${SOLID_STORAGE_BASE_URL}${actorName}/outbox/` (creating a new page when the current one is full, and patching the collection's `first`/`next` links).
10. Persist the activity to that page by PATCHing a `solid:InsertDeletePatch` against the pod.

Response: `200` with `{status, delivered, failed, results}`. Partial delivery is reported, not retried.

### Outbox GET `/${actorName}/outbox[/pages/{page}]`

Per-actor proxy of the paged outbox collection from the pod. No DPoP token is required on the incoming request; only the outgoing fetch to the pod is DPoP-authenticated. The `{page}` is the path of a specific page on the pod (e.g. `pages/12345`); omitting it proxies the collection root.

1. Load config; resolve `actorName` from the path; reject 404 if not configured.
2. Resolve the `{page}` from the request path (preserving trailing slash).
3. Compute the pod target as `${SOLID_STORAGE_BASE_URL}${actorName}/outbox/{page}`.
4. Create a DPoP-authenticated fetch to the pod and GET the target with the request's `Accept` header (default `text/turtle`).
5. Read the pod response body.
6. Rewrite the pod URL prefix to the public actor-scoped prefix in the body so consumers see `${BASE_URL}/${actorName}/outbox/...`.
7. Return the body to the caller with CORS headers.

### Inbox POST

One route per registered actor, e.g. `/alice/inbox`. HTTP-signature-authenticated. The handler ignores any sub-path — paging is managed internally. The URL names the local actor, and the activity is processed as if addressed to that actor. A server-wide shared inbox at `/inbox` is also exposed — see *Shared Inbox POST* below.

- For `Follow`: `object` must equal `${BASE_URL}/${actorName}` (else reject 422).
- For `Undo` of `Follow`: the inner `object` must equal `${BASE_URL}/${actorName}` (else reject 422).
- For any other activity: trust the URL and persist to `${actorName}/inbox/`. No content-addressing check.

1. Resolve `actorName` from the path; reject 404 if not a registered actor.
2. Parse the body as JSON; reject 400 on parse error. **Debugging:** on signature-verification failure (step 3) or handler rejection (step 4 — 422), the inbox logs `[router] inbox reject: type=… actor=… [object=…]` so the rejected activity is identifiable in function logs. Successful processing is intentionally not logged.
3. Verify the HTTP signature on the request via `verifyIncomingActivity`: require `Signature`/`Date`/`Digest` headers, verify the `Digest` against a SHA-256 of the raw request body (not a re-serialisation of the parsed JSON — this allows pretty-printed or differently-ordered sender bodies to verify), fetch the actor's `publicKeyPem` (signed GET with `(request-target) host date` using the local actor's key — required by Mastodon and other servers that gate actor JSON behind HTTP signatures; with SSRF protection), and cryptographically verify the signature. Also bind the actor: `activity.actor` must equal the URL the signing keyId belongs to, else 400.

   The signing string is rebuilt from the `headers=` list in the `Signature` header, in the order declared there, with names lowercased as the spec requires: `(request-target)` is the lowercased method, a space, then the path plus its query string when present; `host` uses the `Host` header and falls back to the request URL's host when it is absent. Every other declared header is read by name, so senders that sign extra headers verify — Mastodon signs `Collection-Synchronization` on followers-only status deliveries and on follower sync. A declared header that is missing or empty, or a pseudo-header other than `(request-target)` such as `(created)`, is a hard 400 (`missing_signed_header`) rather than a silently shortened signing string.
   - **Debugging:** a failure logs a single `[router] signature auth failed …` line carrying structured `key=value` context. A `[router] inbox reject: type=… actor=… [object=…]` line follows, identifying the rejected activity. Useful fields to triage:
     - `code=` — the specific failure (e.g., `missing_signature`, `digest_mismatch`, `actor_url_blocked`, `actor_fetch_failed`, `missing_signed_header`, `no_local_actor`, `signature_invalid`, `actor_binding_mismatch`).
     - `keyId=`, `actorUrl=` — who the sender claimed to be.
     - `digestHeader=`, `expectedDigest=`, `actualDigest=`, `bodyLength=` — for `digest_mismatch`, the declared hash vs the hash we computed over the raw body bytes.
     - `algorithm=`, `signedHeaders=`, `signingString=` — for `signature_invalid`, the exact string the signature was computed over (newlines escaped as `\n`).
     - `missingHeaders=` — for `missing_signed_header` (400), the declared headers the request did not carry (or that were empty).
     - `signedActorFetch=`, `signerKeyId=` — for `actor_fetch_failed`, whether the actor-document GET was HTTP-signed and with which local actor key. `signedActorFetch=false` means it went out unsigned; a signature-gated remote such as Mastodon always answers that with 401, so treat it as a local configuration problem, not a remote one.
     - `actorFetchStatus=`, `cause=` — for `actor_fetch_failed`, the remote actor document's HTTP status and underlying error. With `signedActorFetch=true`, a persistent `actorFetchStatus=401` means the remote server still rejected our signed GET (key not registered, key rotated, clock skew on their `Date` check) — not that the server is unreachable.
4. Switch on activity type:
   - `Delete` → ack and return (no persistence).
   - `Follow` → send a signed `Accept` (signed with the matched local actor's key) to the follower's inbox, and add the follower to the followers collection at `${SOLID_STORAGE_BASE_URL}${actorName}/followers/`.
   - `Undo` of `Follow` → remove the follower from `${actorName}/followers/`.
   - `Accept` of `Follow` for this actor (delivered to the per-actor `/actor/inbox` only) → add the wrapped `Follow.object` (the followed actor URI) to the following collection at `${SOLID_STORAGE_BASE_URL}${actorName}/following/`. Other Accept activities are acked without persistence.
   - `Follow`/`Undo` also maintain an `as:totalItems` literal on the followers collection root via a `solid:InsertDeletePatch` that swaps the old literal for the new one (`addToFollowers` increments after a successful per-page item PATCH; `removeFromFollowers` decrements after a successful remove). The first add patches from "no triple" to `1`; decrements never go below `0`. Concurrent mutations can drift the counter; a drift self-corrects on the next mutation.
   - Anything else → derive the next paged-inbox slot under `${SOLID_STORAGE_BASE_URL}${actorName}/inbox/` and persist via `solid:InsertDeletePatch`.

#### Shared Inbox POST `/inbox`

Single server-wide endpoint at `${BASE_URL}/inbox`, HTTP-signature-authenticated. Advertised as `endpoints.sharedInbox` in every actor's AS2 document so remote servers (Mastodon, etc.) can collapse per-follower deliveries — in particular `Delete` activities for account deletion, which arrive once per origin server instead of once per followed actor. The pipeline is identical to the per-actor route above (actor-`Delete` short-circuit, signature verification, Follow/Undo Follow/persist semantics) — the only piece the shared inbox adds is **target-actor resolution**, in this priority:

- `Follow`: `activity.object` must equal a configured `actor.url`.
- `Undo` `Follow`: `activity.object.object` must equal a configured `actor.url`.
- Other activities: scan `to`/`cc`/`bto`/`bcc`/`audience` for the first value matching a configured `actor.url` or `actor.followersUrl`.

Signature verification needs a local actor to sign the actor-document GET. The router picks the first registered actor (by name) as that signer; if the registry is empty it logs `code=no_local_actor` and returns 503 without verification instead of falling back to an unsigned fetch, which signature-gated servers such as Mastodon reject with 401. An empty registry after a deploy means the `restore --from-actor-keys` migration has not run.

No match → 422 (never silently drop into the wrong inbox; never persist when the target is ambiguous). GET on `/inbox` is not supported (POST-only, matching Mastodon's behavior).

### Inbox GET `/${actorName}/inbox[/pages/{page}]`

Per-actor DPoP-authenticated proxy of the paged inbox collection on the pod, with pod URLs rewritten to the public actor-scoped prefix. The `{page}` is the path of a specific page on the pod (e.g. `pages/12345`); omitting it proxies the collection root.

1. Load config; resolve `actorName` from the path; reject 404 if not configured.
2. Resolve the `{page}` from the request path (preserving trailing slash).
3. Verify the DPoP token via `verifyDpopToken` (with the request URL and `GET` method); reject 401/403 on failure or if the issuer is not in `WHITELISTED_ISSUERS`. **Debugging:** a failure logs `[router] GET /${actorName}/inbox auth failed: <reason>` — grep this to distinguish a missing header, an issuer not in `WHITELISTED_ISSUERS`, or a token-verification failure (bad signature, expired token, clock skew).
4. Compute the pod target as `${SOLID_STORAGE_BASE_URL}${actorName}/inbox/{page}`.
5. Create a DPoP-authenticated fetch to the pod and GET the target with the request's `Accept` header (default `text/turtle`).
6. Read the pod response body.
7. Rewrite the pod URL prefix to the public actor-scoped prefix in the body so consumers see `${BASE_URL}/${actorName}/inbox/...`.
8. Return the body to the caller with CORS headers.

### Public per-actor collection GET `/followers` and `/following`

Per-actor CORS-enabled public proxy of the followers and following collections on the pod, with pod URLs rewritten to the public actor-scoped prefix. Both collections follow the same algorithm and are documented together here. The route is `/${actorName}/{collection}[/pages/{page}]` with `collection ∈ {followers, following}`.

1. Load config; resolve `actorName` from the path; reject 404 if not configured.
2. Resolve the `{page}` from the request path (preserving trailing slash).
3. Compute the pod target as `${SOLID_STORAGE_BASE_URL}${actorName}/{collection}/{page}`.
4. Create a DPoP-authenticated fetch to the pod and GET the target with the request's `Accept` header (default `text/turtle`).
5. Read the pod response body.
6. Branch on `Accept`:
   - `application/activity+json` (or `application/ld+json` with the AS profile), on the collection root or a page: serialise to AS2 JSON and return `Content-Type: application/activity+json`.
      - The collection root is an `OrderedCollection` with `totalItems` and `first` (a public-URL `OrderedCollectionPage`).
      - Each page is an `OrderedCollectionPage` with `partOf`, an `orderedItems` array of actor URIs (a follower's URI for `/followers`, a followed actor's URI for `/following`), and optional `next`.
      - All `id`/`first`/`partOf`/`next` use the public URL prefix `${BASE_URL}/${actorName}/{collection}[/...]` (never the pod URL).
   - Otherwise (`text/turtle` or absent): rewrite the pod URL prefix to the public actor-scoped prefix in the body so consumers see `${BASE_URL}/${actorName}/{collection}/...`.
7. Return the body with CORS headers (`Access-Control-Allow-Origin` echoes `Origin` and falls back to `*`; preflight returns `204`).

### Actor GET `/${actorName}`

Per-actor AS2 actor document served by the `actor-router` function.

1. Resolve `actorName` from the path; reject 404 if not a registered actor.
2. Read the actor's RSA public JWK from the runtime registry and export it as a PEM (`importJWK` + `exportSPKI` from `jose`). Cached in module scope per instance and invalidated when the registry record's `updatedAt` changes.
3. Build the immutable skeleton: `id`, `preferredUsername`, `inbox`, `outbox`, `followers`, `following`, `liked`, `publicKey` (with the PEM and `id: ${BASE_URL}/${actorName}#main-key`, `owner: ${BASE_URL}/${actorName}`), and `manuallyApprovesFollowers: false`. `type` defaults to `Service`.
4. Attempt to fetch the profile from `${SOLID_STORAGE_BASE_URL}${actorName}/profile` (DPoP-authenticated, `Accept: text/turtle`). On 200, parse with `n3` and overlay any recognized fields onto the skeleton. On non-200 or parse error, log and leave the skeleton unchanged — the response still serves with default `type: 'Service'` and no profile fields.
5. Return the merged JSON with `Content-Type: application/activity+json` and the CORS headers used elsewhere by the function.

The same `GET /:actor` route also serves a default browser UI: when the request's `Accept` header includes `text/html`, the function returns an HTML page backed by [Pod-OS Elements](https://pod-os.org) that reads the actor JSON-LD at `${BASE_URL}/${actorName}` and renders the profile and outbox. For any other Accept value (missing, `application/activity+json`, `application/ld+json`, `*/*`) the response is the AS2 JSON document above, so Mastodon-style federation flows are unchanged.

### WebFinger `/.well-known/webfinger?resource=acct:${actorName}@${domain}`

Served by a Netlify Edge Function (`netlify/edge-functions/webfinger.ts`) from the runtime actor registry. It returns JRD JSON describing the matching actor (200), or 404 when the resource is unknown or the actor is disabled. Adding an actor does not require a redeploy.

### Adding actors at runtime

Actor identity is written at runtime through the admin API, not baked into a build. The `netlify/functions/admin-actors.mts` function is reachable at `/admin/actors` and authenticates with a Solid-OIDC DPoP token whose `webid` matches `ADMIN_WEBID`. Writes are allowed in production and the local dev context; deploy previews and branch deploys are rejected.

| Request | Effect |
|---------|--------|
| `GET /admin/actors` | List the public actor records. |
| `POST /admin/actors` | Create an actor: generate an RS256 keypair, write the envelope-encrypted private key to `ACTOR_SECRET_STORE`, then write the public record to `ACTOR_REGISTRY_STORE`. |
| `POST /admin/actors/:name/disable` | Mark the actor disabled so WebFinger and the actor document stop resolving it. |
| `POST /admin/actors/:name/rotate` | Replace the actor's RSA keypair and update its registry record. |

The create request body carries only the actor name; the keypair, `keyId`, and endpoints are generated or derived:

```http
POST /admin/actors
Content-Type: application/json

{ "name": "alice" }
```

The response is the new public registry record:

```json
{
  "name": "alice",
  "publicKeyJwk": { "kty": "RSA", "n": "…", "e": "AQAB" },
  "createdAt": "2026-10-18T00:00:00.000Z",
  "updatedAt": "2026-10-18T00:00:00.000Z",
  "disabled": false
}
```

`disable` and `rotate` take the actor name in the path and no request body.

Creating an actor makes it discoverable through WebFinger immediately. Pod collections are created lazily on the first activity, and the profile remains an operator-managed document on the pod.

### Default UI

A browser-friendly interface is shipped as static assets in `static-ui/` and copied into `public/` by `scripts/generate-identity.ts` on every build:

- `GET /` — static landing page (`public/index.html`) that renders the actor list client-side with PodOS Elements from the public `GET /actors` Turtle collection (`as:Collection` with `as:items`), and embeds `templates/actor-controls/actor-controls.html` so visitors can sign in with their WebID and see the actors they control. The page HTML is static; the actor list follows the registry without a rebuild.
- `GET /:actor` with `Accept: text/html` — per-actor page (`actor-page.template.html`) rendered by Pod-OS Elements. The page reads the actor JSON-LD at `${BASE_URL}/${actorName}` to display `as:name` and `as:summary`, then follows `as:outbox` to walk the paged outbox collection (the existing outbox GET endpoint already serves Turtle with public-URL rewriting). The page uses Ionic for layout and the `<import-html>` custom element (`public/components/ImportHtml.js`) to inline Pod-OS fragment templates at `public/templates/{actor-controls/actor-controls,discussion/{header,outbox}}.html`. The `<pos-app>` wrapper has the `restore-previous-session` attribute so visitors stay signed in across page reloads; the same `actor-controls` fragment is mounted at the top so authenticated visitors can navigate to other actors they control.

UI sources live in `static-ui/` (tracked). Operators wanting to customise the landing page, per-actor template, or login fragment can edit those files; the next build overwrites the copies in `public/`.

#### Registering actors on the user's pod

Creating the actor identity is handled by the admin API above; this section covers the pod-side Type Index entry that makes the actor appear in the browser UI.

Operators register an actor by adding a `solid:TypeRegistration` entry to their WebID's public Type Index. The fragment matches the five ActivityPub Actor Types — `as:Service`, `as:Person`, `as:Group`, `as:Organization`, `as:Application`. Example for an operator with two actors — one bot (`Service`) and one human account (`Person`) — running on `${BASE_URL}`:

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix as:    <https://www.w3.org/ns/activitystreams#>.

<https://alice.example/webid#me>
    solid:publicTypeIndex <https://alice.example/settings/publicTypeIndex.ttl>.

<https://alice.example/settings/publicTypeIndex.ttl> a solid:TypeIndex.

<#relay>
    a solid:TypeRegistration ;
    solid:forClass as:Service ;
    solid:instance <https://example.netlify.app/relay>.

<#alice>
    a solid:TypeRegistration ;
    solid:forClass as:Person ;
    solid:instance <https://example.netlify.app/alice>.
```

After signing in, the actor-controls fragment renders two rows: one for `https://example.netlify.app/relay` (typed `Service`) and one for `https://example.netlify.app/alice` (typed `Person`). Each is a clickable link that navigates to the per-actor page.

### Custom web components

Web components shipped from `static-ui/components/`, copied into `public/components/` at build time.

- [`<import-html>`](static-ui/components/ImportHtml.js) — used in `actor-page.template.html` to inline Pod-OS fragment templates.

## Testing

```bash
npm run typecheck          # TypeScript
npm run test:unit          # Pure module tests (registry, crypto, handlers) with Blobs mocked
npm run test:integration   # Netlify function handlers with mocked dependencies
npm run test:e2e           # Real `netlify dev` (functions, edge, local Blobs) + a mock Solid server
```


```
.
├── netlify/
│   ├── edge-functions/
│   │   ├── actors.ts        # GET /actors, public Turtle actor collection
│   │   └── webfinger.ts     # /.well-known/webfinger, registry-backed edge handler
│   └── functions/
│       ├── actor-router.mts # Per-actor /:actor(/outbox|/inbox|/followers) — also serves /:actor (AS2 profile, profile overlay)
│       └── admin-actors.mts # /admin/actors, authenticated runtime actor administration
├── netlify.toml             # Build config + function routing
├── public/                  # Auto-generated service identity at build (gitignored)
│   ├── webid                # WebID Turtle
│   ├── jwks.json            # OIDC signing key (public)
│   └── .well-known/         # openid-configuration
├── scripts/
│   ├── generate-identity.ts # Generates service identity and static UI
│   └── actors-backup.ts     # Offline backup/restore; --from-actor-keys seeds from a saved src/actor-keys.ts
├── src/
│   ├── activity.ts          # Activity validation, normalization, recipient extraction
│   ├── actors/              # Runtime registry, encrypted secrets, key lookup
│   ├── auth.ts              # DPoP token verification
│   ├── config.ts            # Service config loading
│   ├── handlers/            # Inbox/outbox activity handlers (per-actor aware)
│   ├── services/            # Solid-pod + RDF helpers (paging, patching, followers, following, actorDoc.ts)
│   ├── signing.ts           # Outgoing HTTP signature signing (per-actor key lookup)
│   ├── solidFetch.ts        # DPoP-authenticated fetch to pod
│   ├── ssrf.ts              # SSRF protection for remote actor key fetches
│   ├── types.ts
│   ├── verifyHttpSignature.ts # HTTP signature parsing + crypto verification primitives
│   ├── verifyRequest.ts     # End-to-end HTTP signature verification (inbox POST)
│   ├── base-url.ts          # Generated (gitignored)
│   └── private-key.ts       # Generated OIDC ES256 key (gitignored)
└── tests/
    ├── helpers.ts
    ├── helpers/             # dev-server + mock Solid server
    ├── unit/                # Pure module tests
    ├── integration/         # Netlify function handler tests with mocked deps
    └── e2e/                 # Tests against `netlify dev` + mock Solid server, incl. runtime actor lifecycle
```

## Architecture

### Actor identity and storage

Actor identity and actor content have separate sources of truth.

- **Runtime actor identity** lives in Netlify Blobs:
  - `actor-registry` is the source of truth for whether an actor exists. Each record is keyed by actor name and holds `publicKeyJwk`, `createdAt`, `updatedAt`, and `disabled`.
  - `actor-secrets` holds each actor's private RSA JWK, envelope-encrypted with `ACTOR_KEY_ENCRYPTION_KEY` before it is written. It is subordinate to the registry: an actor exists only once its public record is present.
  - Both stores are read with `consistency: "strong"` and written with compare-and-swap (`onlyIfNew` / `onlyIfMatch`), so concurrent create, rotate, and disable operations cannot silently overwrite each other.
- **Actor content** lives on the Solid pod: the profile and the paged inbox/outbox/followers/following collections. The registry, not the pod, determines whether an actor exists.
- **Service identity** is build-time: the OIDC ES256 key, `public/jwks.json`, `public/webid`, and OIDC discovery are site-level, not per-actor.

Actors can be added, disabled, or key-rotated without a redeploy. The OIDC service key is generated at build time.

### Components and trust boundaries

- **Netlify compute** (`netlify/functions/actor-router.mts`, `netlify/edge-functions/webfinger.ts`, `netlify/edge-functions/actors.ts`): the externally reachable surface for ActivityPub. Stateless across invocations; code is reconstructed on every cold start by the build. `actor-router.mts` resolves actors from the runtime registry and handles the per-actor `/{actorName}` GET (AS2 actor document with profile overlay) and `/{actorName}/{outbox,inbox,followers}` GET/POST routes, plus the single server-wide `/inbox` shared inbox (advertised as `endpoints.sharedInbox` on every actor document). `webfinger.ts` runs at the edge and serves `/.well-known/webfinger` from the same registry; `actors.ts` serves the public `/actors` Turtle collection used by the landing page.
- **Netlify Blobs**: durable, site-wide storage for actor identity. The `actor-registry` store is the authoritative public record and `actor-secrets` holds envelope-encrypted private keys. Blobs have no public URL; only site code can read them, and the `actor-router` function is the only runtime consumer of the secret store.
- **Solid pod** at `${SOLID_STORAGE_BASE_URL}`: durable storage for per-actor containers `${actorName}/inbox/`, `${actorName}/outbox/`, and `${actorName}/followers/` as paged AS2 collections, plus an operator-managed `${actorName}/profile` Turtle document. The function is the only writer for the collections; reads (including the profile) happen via a DPoP-authenticated fetch (`src/solidFetch.ts`).
- **OIDC issuer**: any issuer in `WHITELISTED_ISSUERS` is trusted to authenticate users who may access the private collections (outbox write + inbox read). The function verifies each request's DPoP-bound access token via `@solid/access-token-verifier` — confirming the client controls the bound key and the token's issuer is in the allowlist.
- **Remote ActivityPub servers**: discovered via WebFinger and actor-document fetches (`src/activity.ts`, `src/verifyRequest.ts`).
- **Static service identity** in `public/`: OIDC discovery, WebID, and JWKS. Served by Netlify's CDN, regenerated on every build. Actor identity is read from Blobs at runtime.

### Per-actor keypairs

- **OIDC ES256** (one): private in `src/private-key.ts`, public in `public/jwks.json`. Verifies incoming DPoP tokens (`auth.ts`) and mints the DPoP token for the function's own pod traffic (`solidFetch.ts`). The public JWK can be supplied via `JWKS` to reuse a keypair across deploys.
- **Actor RS256** (one per actor): private JWKs live envelope-encrypted in the `actor-secrets` Blobs store; the public JWK lives in the `actor-registry` record. The public PEM is derived on demand and embedded in the actor document as `publicKey.publicKeyPem` — the AS2 field name remote servers use to verify the HTTP signatures this actor signs on outgoing requests (`signing.ts`). Keys are created and rotated at runtime.

### Data on the pod

The pod is the source of truth for actor content. All collections are stored as paged `as:Collection` + `as:OrderedCollectionPage` resources, grouped under a per-actor container:

```
${SOLID_STORAGE_BASE_URL}/
├── ${actorName}/           # one container per registered actor
│   ├── profile             # operator-managed Turtle profile (as:type, as:name, as:summary, as:icon, as:image)
│   ├── inbox/              # inbound activities
│   ├── outbox/             # published activities
│   ├── followers/          # followers of this actor
│   └── following/          # actors this actor follows
```

Each page is a Turtle document with `as:items` quads pointing at its entries; pages are linked via `as:next` and the collection holds a single `as:first` pointing at the head page. Writes are PATCHes of a `solid:InsertDeletePatch` (see `src/services/buildPatch.ts`) — never full-document overwrites — so a single PATCH is the unit of consistency. For the `followers` and `following` collections, each `as:items` value is an actor URI directly (matching the W3C AS2 paged-OrderedCollection shape that Mastodon and other fediverse servers expect).

The `profile` resource is a single Turtle document that the `actor-router` function reads on every `GET /${actorName}` and overlay-merges onto the skeleton it builds from the actor's registry record and actor RSA public key. 

Example profile:

```turtle
@prefix as: <https://www.w3.org/ns/activitystreams#>.

<${SOLID_STORAGE_BASE_URL}${actorName}/profile>
  a as:Person;
  as:name "Alice Example";
  as:summary "<p>Bio. <em>HTML allowed</em> — Mastodon sanitises server-side.</p>";
  as:icon <${SOLID_STORAGE_BASE_URL}${actorName}/profile#icon>;
  as:image <${SOLID_STORAGE_BASE_URL}${actorName}/profile#image>.

<${SOLID_STORAGE_BASE_URL}${actorName}/profile#icon> a as:Image; as:mediaType "image/png"; as:url "https://cdn.example/avatar.png".
<${SOLID_STORAGE_BASE_URL}${actorName}/profile#image> a as:Image; as:mediaType "image/jpeg"; as:url "https://cdn.example/header.jpg".
```
