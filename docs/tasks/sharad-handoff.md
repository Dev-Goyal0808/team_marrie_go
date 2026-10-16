# Sharad Backend Handoff

> Prepared from the current workspace inspection on 2026-10-16.
> `docs/tasks/sharad.md` remains the source of truth for the ticket board and acceptance criteria.

## Goal

Continue the Next.js/Node backend delivery for AccessMap under the Sharad plan in
`docs/tasks/sharad.md`.

The in-scope result remains the complete durable platform: public place discovery,
private Accessibility Match Profiles, observations and moderation, idempotent
offline synchronization, PostgreSQL/PostGIS persistence, Redis/Valkey workers and
events, EvidenceGuard, incidents and barrier-aware routing, facility/civic APIs,
authorization, observability, deployment, backups, and release verification.

The non-negotiable product rule is:

> Unknown accessibility information must never become a confirmed match or a
> universal accessibility score.

The current immediate delivery target is the S-001 foundation, followed by the
ticket dependencies in `docs/tasks/sharad.md`. Do not mark a ticket VERIFIED
until its acceptance checks have actually run.

## State

### Working now

- The repository is on branch `main`.
- Git HEAD metadata identifies revision
  `ecbcf06b9a788682fd264388ed74bc5247194f7d`.
- The workspace contains an npm monorepo with `apps/*` and `packages/*`
  workspaces, plus a declared `workers/*` workspace.
- A JavaScript Node API foundation exists at `apps/api/src/server.mjs`. It
  exposes a versioned `GET /health` response using `health.v1` and a
  `problem.v1` response for unknown resources.
- API health and unknown-resource tests exist at
  `apps/api/test/health.test.mjs`.
- Shared JavaScript packages exist for contracts, domain values, events, and
  validation.
- The contracts package contains initial schemas and frontend-safe fixtures for
  health, problems, pagination, places, claims, match profiles, explanations,
  observations, incidents, routes, and sessions.
- A JavaScript Next.js web shell exists under `apps/web/**`.
- A local Compose definition exists at `infra/docker-compose.yml` for
  PostgreSQL/PostGIS, Valkey, MinIO, and Mailpit.
- `docs/SETUP.md` documents npm commands, local URLs, the JavaScript-only
  decision, and the current S-001/D-001 scope.

### Incomplete

- The ticket board in `docs/tasks/sharad.md` has not been replaced or updated by
  this handoff. Ticket status must be reconciled deliberately in the next work
  session.
- S-001 acceptance is not verified by this session because no commands were run.
- The API is still a foundation only; real place search, authentication,
  authorization, database persistence, observations, claims, workers, routing,
  and API-connected screens are not implemented.
- S-002 through S-012 remain to be delivered according to their dependencies and
  acceptance criteria.
- The web shell is not connected to real place data or the backend API.
- No database migrations, seed data, row-level security policies, Redis/Valkey
  queues, worker consumers, EvidenceGuard pipeline, SSE stream, routing adapter,
  facility APIs, civic API, webhook delivery, deployment setup, backup/restore
  rehearsal, or production smoke test were found in the inspected workspace.
- Compose services were not started during the documented setup and were not
  started in this session.
- No production provider credentials or deployment environment is configured.

### Blocked or unverified

- Current uncommitted versus committed file state is unknown. The user explicitly
  prohibited running commands, so `git status` and `git diff` were not run.
  Observed paths below therefore cannot be classified as this session's changes
  or unrelated pre-existing work.
- Current test, lint, typecheck, build, and runtime behavior is unverified in
  this session.
- There is no TypeScript typecheck command; the repository is intentionally
  JavaScript-only. Adding TypeScript or a compiler requires an explicit stack
  decision rather than an implicit change.
- Pilot geography, real facility data, auth provider configuration, and
  production infrastructure choices remain open.

## Files

The following meaningful implementation and planning paths were observed. Their
Git change status was not determined because status/diff commands were prohibited.

- `package.json` — npm workspace definition and root development checks.
- `package-lock.json` — npm dependency lockfile documented by the setup note.
- `apps/api/src/server.mjs` — versioned API health endpoint and server bootstrap.
- `apps/api/test/health.test.mjs` — health and problem-response tests.
- `apps/api/package.json` — API workspace metadata.
- `packages/contracts/src/index.mjs` — initial frontend-safe contract schemas.
- `packages/contracts/fixtures/*.json` — initial contract examples for public,
  authenticated, reporting, incident, route, and session surfaces.
- `packages/domain/src/index.mjs` — shared domain values.
- `packages/events/src/index.mjs` — shared event definitions/envelope support.
- `packages/validation/src/index.mjs` — shared validation and problem-response
  helpers.
- `apps/web/app/**` — initial Next.js JavaScript web shell.
- `apps/web/package.json` and `apps/web/eslint.config.mjs` — web workspace setup.
- `infra/docker-compose.yml` — local PostgreSQL/PostGIS, Valkey, MinIO, and
  Mailpit service definitions.
- `docs/SETUP.md` — existing setup note and historical setup evidence; it is not
  a replacement for the Sharad task plan.
- `docs/tasks/sharad.md` — authoritative backend plan; intentionally unchanged.
- `README.md`, `docs/PRODUCT_PLAN.md`, `docs/ARCHITECTURE.md`, and
  `docs/IMPLEMENTATION_PLAN.md` — shared product and architecture constraints;
  intentionally unchanged.

## Decisions and constraints

- Preserve `docs/tasks/sharad.md` as the task-list source of truth.
- Keep backend ownership within the Sharad-owned paths defined there; do not edit
  Dev-owned frontend implementation files to work around missing APIs.
- Use contract-first changes in `packages/contracts/`, with generated/fixture
  updates and contract tests before server response-shape changes.
- Keep PostgreSQL/PostGIS as the durable source of truth. Redis/Valkey may cache,
  coordinate, rate-limit, and queue work, but Redis loss must not lose committed
  observations.
- Keep private profiles, contributor identity details, moderation notes, evidence
  originals, secrets, and raw sensitive payloads out of public responses, logs,
  queue payloads, cache keys, and analytics.
- Keep independent community observations separate from facility responses.
- Preserve unknown, stale, temporary, and conflicting states explicitly.
- Keep the current JavaScript-only and npm-based setup unless an explicit stack
  change is approved.
- Prefer a ticket branch/worktree before implementation; do not continue backend
  work in a shared dirty working directory when a separate worktree is available.
- Do not claim a local build, deployment, merge, or acceptance criterion without
  current evidence.

## Checks

Working folder for all documented commands:

`/home/sharad/Projects/ycce`

All results below are labeled because they were recorded in `docs/SETUP.md`, not
run in this handoff session.

### Test

- **Not run in this session.**
- Historical setup result, dated 2026-10-16 in `docs/SETUP.md`:
  `npm test` — **passed**, 2 tests passed and 0 failed.

### Lint

- **Not run in this session.**
- Historical setup result: `npm run lint` — **passed**.
- Historical setup result: `npm run lint:web` — **passed**.

### Typecheck

- **Not run / not configured.**
- `docs/SETUP.md` states that the implementation is JavaScript-only and
  intentionally has no `typecheck` command or TypeScript compiler.
- A future typecheck requires an explicit TypeScript/toolchain decision.

### Build

- **Not run in this session.**
- Historical setup result: `npm run build` — **passed**, 12 contract fixtures
  validated.
- Historical setup result: `npm run build:web` — **passed**, Next.js production
  build completed with `/` statically prerendered.
- Historical setup result: `npm run check` — **passed**, lint, tests, and build
  completed in sequence.

### Health/manual smoke

- **Not run in this session.**
- Historical setup result: `npm run check:health` — **passed**, ephemeral API
  returned `health.v1`.
- Historical setup result: `npm run dev` — **passed**, a local smoke request
  returned the AccessMap page.
- `docs/SETUP.md` records the API URL as `http://127.0.0.1:3001` and the web
  URL as `http://localhost:3000` when the corresponding process is running.
- No running process was started or stopped by this handoff.

### Infrastructure

- **Skipped.**
- Compose services were not started during the documented setup and were not
  started in this session. This must be verified before database, cache, storage,
  or mail integration work.

### Git evidence

- Branch and revision were read from Git metadata: `main` at
  `ecbcf06b9a788682fd264388ed74bc5247194f7d`.
- **Status/diff not run** because the user explicitly prohibited commands.
- Consequently, no file is described as committed, uncommitted, merged, or
  belonging to this session.

## Next step

After approval of this handoff, run the repository-level Git evidence checks from
`/home/sharad/Projects/ycce`:

1. `git status --short`
2. `git diff --stat`
3. `git diff -- <relevant paths>`

Then reconcile the observed implementation against S-001 in
`docs/tasks/sharad.md`, keeping unrelated local work separate. The first
implementation action should be to choose or create the S-001 ticket
branch/worktree and verify the documented foundation commands before starting
S-002 migrations.
