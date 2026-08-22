# solid-activitypub-netlify

![No maintenance intended](https://img.shields.io/badge/no_maintenance_intended-orange) ![Code quality: TDD vibe coded](https://img.shields.io/badge/code_quality-TDD_vibe_coded-orange)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jg10-mastodon-social/solid-activitypub-netlify#WHITELISTED_ISSUERS=&SOLID_STORAGE_BASE_URL=)

ActivityPub server using Netlify Functions, with collections stored on a Solid pod.

- **Outbox** (POST): Solid-OIDC-authenticated. Normalizes the activity, distributes it to explicit recipients via HTTP-signed POSTs, fans out to followers for public posts, and persists to a paged outbox on the pod.
- **Inbox** (POST): Validates `@context` and binds the authenticated key to `actor`. Sends a signed `Accept` for `Follow` and adds the follower; handles `Undo` `Follow`; persists other activities to a paged inbox.
- **Shared Inbox** (POST `/inbox`): advertised as `endpoints.sharedInbox` on every actor's AS2 document so remote servers can collapse per-follower deliveries into one POST per origin server. See *Inbox POST* below.
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

Build time generates:
- `src/base-url.ts` - site URL (gitignored)
- `src/private-key.ts` - OIDC ES256 signing key (gitignored)
- `src/actor-keys.ts` - per-actor RS256 signing keys (gitignored)
- `public/webid`, `public/jwks.json`, `public/.well-known/openid-configuration` - OIDC identity files

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHITELISTED_ISSUERS` | Yes | Comma-separated list of trusted OIDC issuers |
| `SOLID_STORAGE_BASE_URL` | Yes | Base URL of the Solid pod (must end with `/`) |
| `WEBID` | No | Solid WebID (default: `${BASE_URL}/webid`) |
| `ISSUER` | No | OIDC issuer (default: `${BASE_URL}`) |
| `SEND_TO_URL` | No | URL the outbox DPoP token is bound to (default: `${BASE_URL}/outbox`) |
| `ACTOR_NAME` | No | Comma-separated list of actor names. Default: `actor` (single actor). Examples: `alice`, `alice,bob`, `alice, bob, carol`. Whitespace is trimmed. |
| `ADMIN_WEBID` | No | Admin WebID |
| `JWKS` | No | Existing OIDC JWK (JSON) to reuse instead of generating a new keypair |

## How it works

Each configured actor (named in `ACTOR_NAME`) gets its own RSA signing key, its own outbox/inbox/followers collection on the pod, its own per-actor endpoints, and its own AS2 actor document served by the `actor-router` function (overlay-merged with a profile from the pod on every request). A single server-wide `/inbox` (the shared inbox) is also exposed and advertised on every actor's AS2 document as `endpoints.sharedInbox`.

Every request handled by the actor-router function logs a single `[router] METHOD /path` entry line at the start (e.g. `[router] POST /alice/outbox`), followed by any of the auth-failure / delivery-summary logs documented on each endpoint below. Grepping for `[router]` is the fastest way to follow a single request through the function.

### Outbox POST `/${actorName}/outbox`

One route per configured actor, e.g. `/alice/outbox`. Solid-OIDC-authenticated. The handler ignores any sub-path — paging is managed internally.

1. Resolve `actorName` from the path; reject 404 if not a configured actor.
2. Verify the DPoP token via `verifyDpopToken` (using `@solid/access-token-verifier`); reject with 401/403 on failure or if the token's issuer is not in `WHITELISTED_ISSUERS`. **Debugging:** a DPoP failure logs `[router] POST /${actorName}/outbox auth failed: <reason>` — grep this to distinguish a missing header, an issuer not in `WHITELISTED_ISSUERS`, or a token-verification failure (bad signature, expired token, clock skew).
3. Parse the body as JSON; reject 400 on parse error.
4. Validate `@context` and that `activity.actor` equals `${BASE_URL}/${actorName}`; reject 400/403 on failure.
5. Normalize the activity: assign `id` and `published` if missing.
6. Resolve explicit recipients from `to`/`cc`/`bto`/`bcc`/`audience`, look up each recipient's `inbox` via their actor document, and POST the activity there with an HTTP signature (`RSA-SHA256`, signed with this actor's key from `src/actor-keys.ts`). **Debugging:** a delivery summary logs `[router] POST /${actorName}/outbox delivered to X/Y recipients` — grep this to see the delivery count without parsing the JSON response body.
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

One route per configured actor, e.g. `/alice/inbox`. HTTP-signature-authenticated. The handler ignores any sub-path — paging is managed internally. The URL names the local actor, and the activity is processed as if addressed to that actor. A server-wide shared inbox at `/inbox` is also exposed — see *Shared Inbox POST* below.

- For `Follow`: `object` must equal `${BASE_URL}/${actorName}` (else reject 422).
- For `Undo` of `Follow`: the inner `object` must equal `${BASE_URL}/${actorName}` (else reject 422).
- For any other activity: trust the URL and persist to `${actorName}/inbox/`. No content-addressing check.

1. Resolve `actorName` from the path; reject 404 if not a configured actor.
2. Parse the body as JSON; reject 400 on parse error. **Debugging:** on signature-verification failure (step 3) or handler rejection (step 4 — 422), the inbox logs `[router] inbox reject: type=… actor=… [object=…]` so the rejected activity is identifiable in function logs. Successful processing is intentionally not logged.
3. Verify the HTTP signature on the request via `verifyIncomingActivity`: require `Signature`/`Date`/`Digest` headers, verify the `Digest` against a SHA-256 of the raw request body (not a re-serialisation of the parsed JSON — this allows pretty-printed or differently-ordered sender bodies to verify), fetch the actor's `publicKeyPem` (with SSRF protection), and cryptographically verify the signature. Also bind the actor: `activity.actor` must equal the URL the signing keyId belongs to, else 400.
   - **Debugging:** a failure logs a single `[router] signature auth failed …` line carrying structured `key=value` context. A `[router] inbox reject: type=… actor=… [object=…]` line follows, identifying the rejected activity. Useful fields to triage:
     - `code=` — the specific failure (e.g., `missing_signature`, `digest_mismatch`, `actor_url_blocked`, `actor_fetch_failed`, `signature_invalid`, `actor_binding_mismatch`).
     - `keyId=`, `actorUrl=` — who the sender claimed to be.
     - `digestHeader=`, `expectedDigest=`, `actualDigest=`, `bodyLength=` — for `digest_mismatch`, the declared hash vs the hash we computed over the raw body bytes.
     - `algorithm=`, `signedHeaders=`, `signingString=` — for `signature_invalid`, the exact string the signature was computed over (newlines escaped as `\n`).
     - `actorFetchStatus=`, `cause=` — for `actor_fetch_failed`, the remote actor document's HTTP status and underlying error.
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

1. Resolve `actorName` from the path; reject 404 if not a configured actor.
2. Export the per-actor RSA public key from `src/actor-keys.ts` as a PEM (`importJWK` + `exportSPKI` from `jose`). Computed at cold start and cached in module scope; key rotation therefore requires a redeploy.
3. Build the immutable skeleton: `id`, `preferredUsername`, `inbox`, `outbox`, `followers`, `following`, `liked`, `publicKey` (with the PEM and `id: ${BASE_URL}/${actorName}#main-key`, `owner: ${BASE_URL}/${actorName}`), and `manuallyApprovesFollowers: false`. `type` defaults to `Service`.
4. Attempt to fetch the profile from `${SOLID_STORAGE_BASE_URL}${actorName}/profile` (DPoP-authenticated, `Accept: text/turtle`). On 200, parse with `n3` and overlay any recognized fields onto the skeleton. On non-200 or parse error, log and leave the skeleton unchanged — the response still serves with default `type: 'Service'` and no profile fields.
5. Return the merged JSON with `Content-Type: application/activity+json` and the CORS headers used elsewhere by the function.

The same `GET /:actor` route also serves a default browser UI: when the request's `Accept` header includes `text/html`, the function returns an HTML page backed by [Pod-OS Elements](https://pod-os.org) that reads the actor JSON-LD at `${BASE_URL}/${actorName}` and renders the profile and outbox. For any other Accept value (missing, `application/activity+json`, `application/ld+json`, `*/*`) the response is the AS2 JSON document above, so Mastodon-style federation flows are unchanged.

### WebFinger `/.well-known/webfinger?resource=acct:${actorName}@${domain}`

Served by the `webfinger` Netlify function. Returns JRD JSON describing the matching configured actor (200) or 404 if the resource is unknown.

### Default UI

A browser-friendly interface is shipped as static assets in `static-ui/` and copied into `public/` by `scripts/generate-identity.ts` on every build:

- `GET /` — landing page (`public/index.html`) listing every actor in `ACTOR_NAME` with a `@name@domain` link to its per-actor page.
- `GET /:actor` with `Accept: text/html` — per-actor page (`actor-page.template.html`) rendered by Pod-OS Elements. The page reads the actor JSON-LD at `${BASE_URL}/${actorName}` to display `as:name` and `as:summary`, then follows `as:outbox` to walk the paged outbox collection (the existing outbox GET endpoint already serves Turtle with public-URL rewriting). The page uses Ionic for layout and the `<import-html>` custom element (`public/templates/ImportHtml.js`) to inline Pod-OS fragment templates at `public/templates/discussion/{header,outbox}.html`.

UI sources live in `static-ui/` (tracked). Operators wanting to customise the landing page or per-actor template can edit those files; the next build overwrites the copies in `public/`.

## Testing

```bash
npm run test:unit          # Pure module tests (no HTTP, no pod)
npm run test:integration   # Netlify function handler tests with mocked dependencies
npm run test:e2e           # Real `netlify dev` + a mock Solid server (boots both in-process)
```


```
.
├── netlify/
│   └── functions/
│       ├── actor-router.mts # Per-actor /:actor(/outbox|/inbox|/followers) — also serves /:actor (AS2 profile, profile overlay)
│       └── webfinger.mts    # /.well-known/webfinger dispatcher
├── netlify.toml             # Build config + function routing
├── public/                  # Auto-generated at build (gitignored)
│   ├── webid                # WebID Turtle
│   ├── jwks.json            # OIDC signing key (public)
│   └── .well-known/         # openid-configuration
├── scripts/
│   └── generate-identity.ts # Generates identity, actor keys, webfinger data
├── src/
│   ├── activity.ts          # Activity validation, normalization, recipient extraction
│   ├── auth.ts              # DPoP token verification
│   ├── config.ts            # Config loading (actorNames[], actorByPath map)
│   ├── handlers/            # Inbox/outbox activity handlers (per-actor aware)
│   ├── services/            # Solid-pod + RDF helpers (paging, patching, followers, following, actorDoc.ts)
│   ├── signing.ts           # Outgoing HTTP signature signing (per-actor key lookup)
│   ├── solidFetch.ts        # DPoP-authenticated fetch to pod
│   ├── ssrf.ts              # SSRF protection for remote actor key fetches
│   ├── types.ts
│   ├── verifyHttpSignature.ts # HTTP signature parsing + crypto verification primitives
│   ├── verifyRequest.ts     # End-to-end HTTP signature verification (inbox POST)
│   ├── base-url.ts          # Generated (gitignored)
│   ├── private-key.ts       # Generated OIDC ES256 key (gitignored)
│   └── actor-keys.ts        # Generated per-actor RS256 keys (gitignored)
└── tests/
    ├── helpers.ts
    ├── helpers/             # dev-server + mock Solid server
    ├── unit/                # Pure module tests
    ├── integration/         # Netlify function handler tests with mocked deps
    └── e2e/                 # Tests against `netlify dev` + mock Solid server
```

## Architecture

### Components and trust boundaries

- **Netlify function** (`netlify/functions/{actor-router,webfinger}.mts`): the only externally reachable surface. Stateless across invocations; reconstructed on every cold start by the build. `actor-router.mts` handles the per-actor `/{actorName}` GET (AS2 actor document with profile overlay) and `/{actorName}/{outbox,inbox,followers}` GET/POST routes, plus the single server-wide `/inbox` shared inbox (advertised as `endpoints.sharedInbox` on every actor document); `webfinger.mts` serves the WebFinger dispatcher.
- **Solid pod** at `${SOLID_STORAGE_BASE_URL}`: durable storage for per-actor containers `${actorName}/inbox/`, `${actorName}/outbox/`, and `${actorName}/followers/` as paged AS2 collections, plus an operator-managed `${actorName}/profile` Turtle document. The function is the only writer for the collections; reads (including the profile) happen via a DPoP-authenticated fetch (`src/solidFetch.ts`).
- **OIDC issuer**: any issuer in `WHITELISTED_ISSUERS` is trusted to authenticate users who may access the private collections (outbox write + inbox read). The function verifies each request's DPoP-bound access token via `@solid/access-token-verifier` — confirming the client controls the bound key and the token's issuer is in the allowlist.
- **Remote ActivityPub servers**: discovered via WebFinger and actor-document fetches (`src/activity.ts`, `src/verifyRequest.ts`).
- **Static identity** in `public/`: OIDC discovery, WebID, JWKS, and the WebFinger data file. Served by Netlify's CDN, regenerated on every build.

### Per-actor keypairs

- **OIDC ES256** (one): private in `src/private-key.ts`, public in `public/jwks.json`. Verifies incoming DPoP tokens (`auth.ts`) and mints the DPoP token for the function's own pod traffic (`solidFetch.ts`). The public JWK can be supplied via `JWKS` to reuse a keypair across deploys.
- **Actor RS256** (one per configured actor): private JWKs live in `src/actor-keys.ts` keyed by actor name; the corresponding public PEMs are derived at cold start (`importJWK` + `exportSPKI`) and embedded in the actor document as `publicKey.publicKeyPem` — the AS2 field name remote servers use to verify the HTTP signatures this actor signs on outgoing requests (`signing.ts`).

### Data on the pod

All collections are stored as paged `as:Collection` + `as:OrderedCollectionPage` resources, grouped under a per-actor container:

```
${SOLID_STORAGE_BASE_URL}/
├── ${actorName}/           # one container per configured actor
│   ├── profile             # operator-managed Turtle profile (as:type, as:name, as:summary, as:icon, as:image)
│   ├── inbox/              # inbound activities
│   ├── outbox/             # published activities
│   ├── followers/          # followers of this actor
│   └── following/          # actors this actor follows
```

Each page is a Turtle document with `as:items` quads pointing at its entries; pages are linked via `as:next` and the collection holds a single `as:first` pointing at the head page. Writes are PATCHes of a `solid:InsertDeletePatch` (see `src/services/buildPatch.ts`) — never full-document overwrites — so a single PATCH is the unit of consistency. For the `followers` and `following` collections, each `as:items` value is an actor URI directly (matching the W3C AS2 paged-OrderedCollection shape that Mastodon and other fediverse servers expect).

The `profile` resource is a single Turtle document that the `actor-router` function reads on every `GET /${actorName}` and overlay-merges onto the immutable skeleton it builds from configuration and the per-actor RSA key. 

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
