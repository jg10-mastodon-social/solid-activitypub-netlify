# solid-activitypub-netlify

![No maintenance intended](https://img.shields.io/badge/no_maintenance_intended-orange) ![Code quality: TDD vibe coded](https://img.shields.io/badge/code_quality-TDD_vibe_coded-orange)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jg10-mastodon-social/solid-activitypub-netlify#WHITELISTED_ISSUERS=&SOLID_STORAGE_BASE_URL=&HANDLER_BASE_URL=https://example.com/handlers%23)

ActivityPub server using Netlify Functions, with collections stored on a Solid pod.

- **Outbox** (POST): Solid-OIDC-authenticated. Normalizes the activity, distributes it to explicit recipients via HTTP-signed POSTs, fans out to followers for public posts, and persists to a paged outbox on the pod.
- **Inbox** (POST): Validates `@context` and binds the authenticated key to `actor`. Sends a signed `Accept` for `Follow` and adds the follower; handles `Undo` `Follow`; persists other activities to a paged inbox.
- **GET**: DPoP-authenticated proxy of the paged inbox/outbox collection.
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
- `src/actor-private-key.ts` - actor RS256 signing key (gitignored)
- `public/webid`, `public/jwks.json`, `public/.well-known/openid-configuration` - OIDC identity files
- `public/${ACTOR_NAME}` - AS2 actor document (public key, inbox, outbox, followers)
- `public/.well-known/webfinger` - WebFinger discovery document

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHITELISTED_ISSUERS` | Yes | Comma-separated list of trusted OIDC issuers |
| `SOLID_STORAGE_BASE_URL` | Yes | Base URL of the Solid pod (must end with `/`) |
| `HANDLER_BASE_URL` | Yes | Namespace prefix for handlers |
| `WEBID` | No | Solid WebID (default: `${BASE_URL}/webid`) |
| `ISSUER` | No | OIDC issuer (default: `${BASE_URL}`) |
| `SEND_TO_URL` | No | URL the outbox DPoP token is bound to (default: `${BASE_URL}/outbox`) |
| `ACTOR_NAME` | No | Path segment for the actor document (default: `actor`) |
| `ADMIN_WEBID` | No | Admin WebID |
| `JWKS` | No | Existing OIDC JWK (JSON) to reuse instead of generating a new keypair |

## How it works

### Outbox POST `/outbox`

Solid-OIDC-authenticated. The handler ignores any sub-path — paging is managed internally.

1. Verify the DPoP token via `verifyDpopToken` (using `@solid/access-token-verifier`); reject with 401/403 on failure or if the token's issuer is not in `WHITELISTED_ISSUERS`.
2. Parse the body as JSON; reject 400 on parse error.
3. Validate `@context` and that `activity.actor` matches the server actor; reject 400/403 on failure.
4. Normalize the activity: assign `id` and `published` if missing.
5. Resolve explicit recipients from `to`/`cc`/`bto`/`bcc`/`audience`, look up each recipient's `inbox` via their actor document, and POST the activity there with an HTTP signature (`RSA-SHA256`, signed with the actor key in `src/actor-private-key.ts`).
6. If the activity is public, load the followers collection from the pod and POST the activity to every follower not already in the explicit-recipient set.
7. Derive the next paged-outbox slot on the pod (creating a new page when the current one is full, and patching the collection's `first`/`next` links).
8. Persist the activity to that page by PATCHing a `solid:InsertDeletePatch` against the pod.

Response: `200` with `{status, delivered, failed, results}`. Partial delivery is reported, not retried.

### Outbox GET `/outbox`, `/outbox/{page}`

Proxies the paged outbox collection from the pod. No DPoP token is required on the incoming request; only the outgoing fetch to the pod is DPoP-authenticated. The `{page}` is the path of a specific page on the pod (e.g. `pages/12345`); omitting it proxies the collection root.

1. Load config; resolve the `{page}` from the request path (preserving trailing slash).
2. Compute the pod target as `${SOLID_STORAGE_BASE_URL}outbox/{page}`.
3. Create a DPoP-authenticated fetch to the pod and GET the target with the request's `Accept` header (default `text/turtle`).
4. Read the pod response body.
5. Rewrite the pod URL prefix to the public base URL in the body so consumers see `${BASE_URL}/outbox/...`.
6. Return the body to the caller with CORS headers.

### Inbox POST `/inbox`

HTTP-signature-authenticated. The handler ignores any sub-path — paging is managed internally.

1. Parse the body as JSON; reject 400 on parse error.
2. Verify the HTTP signature on the request via `verifyIncomingActivity`: require `Signature`/`Date`/`Digest` headers, verify the `Digest` against a SHA-256 of the JSON body, fetch the actor's `publicKeyPem` (with SSRF protection), and cryptographically verify the signature. Also bind the actor: `activity.actor` must equal the URL the signing keyId belongs to, else 400.
3. Switch on activity type:
   - `Delete` → ack and return (no persistence).
   - `Follow` → send a signed `Accept` to the follower's inbox and add the follower to the followers collection on the pod.
   - `Undo` of `Follow` → remove the follower from the collection.
   - Anything else → derive the next paged-inbox slot and persist via `solid:InsertDeletePatch`.

### Inbox GET `/inbox`, `/inbox/{page}`

DPoP-authenticated proxy of the paged inbox collection on the pod, with pod URLs rewritten to the public base URL. The `{page}` is the path of a specific page on the pod (e.g. `pages/12345`); omitting it proxies the collection root.

1. Load config; resolve the `{page}` from the request path (preserving trailing slash).
2. Verify the DPoP token via `verifyDpopToken` (with the request URL and `GET` method); reject 401/403 on failure or if the issuer is not in `WHITELISTED_ISSUERS`.
3. Compute the pod target as `${SOLID_STORAGE_BASE_URL}inbox/{page}`.
4. Create a DPoP-authenticated fetch to the pod and GET the target with the request's `Accept` header (default `text/turtle`).
5. Read the pod response body.
6. Rewrite the pod URL prefix to the public base URL in the body so consumers see `${BASE_URL}/inbox/...`.
7. Return the body to the caller with CORS headers.

## Testing

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests with mocked Netlify context
npm run test:e2e	   # Runs against netlify dev server
```


```
.
├── netlify/
│   └── functions/
│       └── outbox.ts     # Entry point
├── netlify.toml          # Build config + function routing
├── public/               # Generated identity files (auto-generated at build)
│   ├── webid
│   ├── jwks.json
│   └── .well-known/
│       └── openid-configuration
├── scripts/
│   └── generate-identity.ts  # Generates identity files from env vars
├── src/
│   ├── auth.ts           # DPoP token verification
│   ├── config.ts         # Config loading
│   ├── solidFetch.ts     # Authenticated fetch
│   ├── types.ts          # Shared types
│   ├── base-url.ts       # Generated at build time (gitignored)
│   └── private-key.ts    # Generated at build time (gitignored)
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Architecture

- **DPoP authentication**: Tokens verified using `@solid/access-token-verifier`. Server identity keys generated at build time.
- **Private key**: Stored in `src/private-key.ts` (bundled into Lambda function, not publicly accessible).
- **Public identity**: Stored in `public/` (jwks.json, webid, openid-configuration) for client verification.
- **Outbox configuration**: RDF file loaded from `OUTBOX_CONFIG_URL`, parsed using `n3`.
- **Identity endpoints**: Server provides OIDC identity via static files in `public/` (`.well-known/openid-configuration`, `webid`, `jwks.json`).
