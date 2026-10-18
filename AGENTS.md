# AGENTS.md

Workflow for agents working in this repo. It describes how changes are planned,
implemented, reviewed, and committed. It is not product documentation; see
`README.md` for architecture and usage.

## Working agreement

- **Architecture first.** For non-trivial work, update `README.md` to describe
  the target state before writing code. The README is written as the current
  architecture, not as a migration history.
- **Two review gates.** The human reviews `README.md` changes and the final
  cutover before those are committed. Everything in between is reviewed
  internally and may be committed autonomously.
- **One commit per cycle.** Keep commits small and scoped to a single logical
  change. Use conventional commits (see below).
- **Never commit a knowingly failing test.** Write the failing test first, keep
  it uncommitted, implement until green, then commit test and implementation
  together.
- **Pure refactors may be committed on their own.** If part of an in-progress
  change is behaviour-preserving, it can be split out and committed as a
  `refactor` before the feature commit.
- **No secrets and no generated artifacts.** Never commit `.env`, private keys,
  or the gitignored generated files (`src/base-url.ts`, `src/private-key.ts`,
  `src/actor-keys.ts`, `src/webfinger-data.ts`, `public/`).

## Cycle workflow

1. **Design.** For a sizeable change, update `README.md` first and get it
   reviewed. Record decisions (storage layout, DX, security) explicitly.
2. **Break down.** Split the work into small TDD cycles with clear boundaries.
   When a cycle is foundational, it lands before the cycles that depend on it.
3. **Red.** Write the failing test for the cycle (unit, integration, or e2e as
   appropriate). Run it and confirm it fails for the intended reason.
4. **Green.** Implement the minimum needed to pass. Keep changes in bounds; do
   not refactor unrelated code.
5. **Verify.** `npm run typecheck`, the targeted suite, then the broader suites
   that could regress (`npm run test:unit`, `npx vitest run tests/integration`,
   relevant e2e files).
6. **Review.** Inspect the diff; optionally use the `review` subagent for a
   second opinion. Present the diff and a proposed commit message.
7. **Commit.** One small conventional commit. Do not commit without the
   required human review for the gate cycles.

## Subagent delegation

- Delegate each implementation cycle to the `general` subagent via the Task
  tool. This agent reviews the result and commits.
- The delegation prompt must include:
  - the cycle goal and the context already present in the repo;
  - the exact red test(s) to write first and why they fail;
  - the files in bounds (and files that are off limits);
  - the commands to observe red then green;
  - the constraints (no commit, no unrelated edits, repo style);
  - the required report format (files, test results, typecheck, deviations).
- Fall back to implementing directly only if the subagent is unavailable, and
  note the fallback in the commit body.

## Commit conventions

`type(scope): subject`, imperative, lower case, no trailing period.

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
- **Scopes used here:** `actors`, `admin`, `webfinger`, `router`, `signing`,
  `pod`, `blobs`, `build`, `cache`, `e2e`, `deps`.

## Verification commands

```bash
npm run typecheck          # TypeScript
npm run test:unit          # pure module tests, Blobs mocked
npm run test:integration   # function handlers with mocked dependencies
npm run test:e2e           # netlify dev + mock pod + local Blobs (slow)
npm test                   # all projects
```

## Environment

```bash
npm install
CONTEXT=dev DEPLOY_URL=http://localhost:9999 URL=http://localhost:9999 \
  node scripts/generate-identity.ts
netlify dev --context dev
```

`generate-identity.ts` produces service identity (site URL, OIDC key, `jwks.json`,
`webid`, OIDC config) and the static UI. Actor identity is created at runtime
through the admin API, or seeded from a saved keys file with
`node scripts/actors-backup.ts restore --from-actor-keys`.

Runtime variables (for example `ACTOR_KEY_ENCRYPTION_KEY`, `ADMIN_WEBID`) are
set in the Netlify UI/CLI, not `netlify.toml`. The dev context in `netlify.toml`
only carries local development values.

## Repo gotchas

- **Generated files and test ordering.** The e2e cleanup deletes
  `src/actor-keys.ts`, `src/webfinger-data.ts`, and `src/private-key.ts`. Unit
  tests transitively import some of these, so regenerate identity before
  running unit tests after an e2e run.
- **Edge import specifiers.** Netlify's local edge bundler does not map `.js`
  specifiers to `.ts` files, so the edge import chain
  (`netlify/edge-functions/webfinger.ts` and its `src/actors/*` imports) uses
  explicit `.ts` specifiers. The rest of the repo uses `.js`.
- **Blobs are not a database.** The actor registry uses a single JSON document
  per store with strong consistency and compare-and-swap
  (`onlyIfNew` / `onlyIfMatch`). Do not build counters or read-modify-write
  logic on a blob key.
- **Blobs region.** Site-wide stores default to `us-east-2`, matching the
  functions region. If the functions region ever changes, revisit this.
- **Dev-only SSRF allowlist.** `ACTOR_FETCH_ALLOW_PRIVATE_HOSTS` is honoured
  only when `CONTEXT=dev` or `NETLIFY_DEV=true`, so e2e can fetch loopback mock
  actors. It must never be enabled in production.
- **e2e flakiness.** The dev server startup can occasionally fail or time out;
  re-run the affected file before treating it as a real failure.
