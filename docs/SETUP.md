# AccessMap setup

## Project goal

AccessMap helps people decide whether a public place is likely to meet their
individual access needs. It reports feature-level observations, sources, dates,
barriers, and uncertainty instead of assigning a universal accessibility score.

The first useful backend result is the S-001 foundation:

- An npm workspace that works without pnpm.
- A versioned API health response.
- A JavaScript Next.js web shell that starts with `npm run dev`.
- Shared JavaScript contract, domain, event, and validation packages.
- Contract fixtures for the first public, authenticated, reporting, incident,
  route, and session surfaces.
- A local PostgreSQL/PostGIS, Valkey, MinIO, and Mailpit Compose definition.
- Repeatable JavaScript syntax, contract, unit, build, and health checks.

The product rule from `README.md`, `docs/PRODUCT_PLAN.md`, and
`docs/tasks/sharad.md` is mandatory:

> Unknown accessibility information must never become a confirmed match or a
> universal accessibility score.

## Intended users

- People with disabilities and chronic health conditions.
- People with temporary injuries or limited mobility.
- Older adults and caregivers.
- Community contributors who observe access conditions.
- Facility managers and public-service operators.
- Moderators, disability organizations, and local authorities.

## Current scope

This setup implements the small S-001 foundation slice and the initial D-001
web shell. It does not yet implement database migrations, authentication, real
place search, observations, claims, workers, routing, or API-connected screens.

The web shell is JavaScript-only, uses the Next.js App Router, and is a
separate npm workspace at `apps/web`. The backend foundation is also
JavaScript-only, as agreed for this workspace; no TypeScript source or
TypeScript compiler is configured.

## Stack and package manager

- Runtime: Node.js `v24.21.0` confirmed locally on 2026-10-16; the workspace
  requires Node.js `20.0.0` or newer.
- Package manager: npm `12.2.0` confirmed locally; npm `10.0.0` or newer is
  required. pnpm is not required.
- Web application: Next.js `16.4.2`, React `19.3.1`, and the App Router.
- API foundation: Node.js built-in HTTP server in `apps/api`.
- Workspace: npm workspaces in the repository root.
- Durable data target: PostgreSQL with PostGIS.
- Coordination target: Valkey-compatible Redis.
- Evidence target: MinIO locally and S3-compatible storage later.
- Mail target: Mailpit locally and a configured provider later.
- Code language: JavaScript modules (`.mjs`).

Docker `29.1.3` is also available locally. The Compose services are defined
but were not started during setup because starting them is an external local
service action.

## Commands

Run these from the repository root:

```text
npm install
npm run dev
npm run lint
npm run lint:web
npm test
npm run build
npm run build:web
npm run check:health
npm run check
npm run dev:api
```

The web app listens on `http://localhost:3000` when `npm run dev` is running.
The API listens on `http://127.0.0.1:3001` when `npm run dev:api` is running,
and its first endpoint is:

```text
GET /health
```

Start local infrastructure only when database, cache, storage, or mail work
requires it:

```text
docker compose -f infra/docker-compose.yml up -d
```

Stop those local services with:

```text
docker compose -f infra/docker-compose.yml down
```

These Compose commands were not run during this setup slice.

### Check meanings

| Command | Working folder | Purpose |
| --- | --- | --- |
| `npm run lint` | Repository root | Checks JavaScript syntax, JSON parsing, and rejects TypeScript source. |
| `npm run lint:web` | Repository root | Runs the Next.js ESLint configuration for `apps/web`. |
| `npm test` | Repository root | Runs Node's built-in tests, including the API health and problem-response tests. |
| `npm run build` | Repository root | Validates all contract fixtures and writes `dist/contracts-manifest.json`. |
| `npm run build:web` | Repository root | Creates the optimized Next.js production build. |
| `npm run check:health` | Repository root | Starts an ephemeral local API server and verifies `GET /health`. |
| `npm run check` | Repository root | Runs lint, tests, and build in sequence. |
| `npm run dev` | Repository root | Starts the JavaScript Next.js web shell at `http://localhost:3000`. |
| `npm run dev:api` | Repository root | Starts the API with Node's watch mode for local development. |

There is intentionally no `typecheck` command because this implementation is
JavaScript-only. A future TypeScript decision would require an explicit stack
change rather than a hidden compiler addition.

### Checks run during setup

These commands were run from `/home/sharad/Projects/ycce` after installing the
declared npm workspace dependencies:

| Command | Result |
| --- | --- |
| `npm run lint` | Passed: JavaScript syntax and JSON checks passed. |
| `npm run lint:web` | Passed: Next.js ESLint checks passed. |
| `npm test` | Passed: 2 tests passed, 0 failed. |
| `npm run build` | Passed: 12 contract fixtures validated. |
| `npm run build:web` | Passed: Next.js production build completed with `/` statically prerendered. |
| `npm run check:health` | Passed: ephemeral API returned `health.v1`. |
| `npm run check` | Passed: lint, tests, and build passed in sequence. |
| `npm run dev` | Passed: local smoke request returned the AccessMap page. |
| `git diff --check` | Passed: no whitespace errors. |

`npm install` was run after approval to create the web app. It generated the
root `package-lock.json`. npm reported that one optional `unrs-resolver`
postinstall script was blocked by its install-script policy; Next.js build and
development smoke checks still passed. No Docker Compose services were started.

## First acceptance criteria

The S-001 foundation is useful when:

1. `npm install` completes from a clean checkout without pnpm.
2. `npm run dev` serves the JavaScript Next.js web shell.
3. `npm run lint`, `npm test`, and `npm run build` pass.
4. `npm run check:health` receives a `health.v1` response from the API.
5. Contract fixtures remain frontend-safe and contain no server credentials.
6. The next backend work can add migrations and services without changing the
   contract package shape.

## Setup gaps

- The Next.js web shell has no real API integration or place data yet.
- Database migrations, seed data, auth, Redis/Valkey workers, evidence storage,
  and integration services remain unimplemented.
- A pilot geography and real facility dataset are not yet selected.
- No production provider credentials or deployment environment are configured.

## Source of decisions

- Product goal, users, and product rule: `README.md` and
  `docs/PRODUCT_PLAN.md`.
- Boundaries and recommended infrastructure: `docs/ARCHITECTURE.md`.
- Delivery order and check categories: `docs/IMPLEMENTATION_PLAN.md`.
- Backend ownership and S-001 acceptance criteria: `docs/tasks/sharad.md`.
- JavaScript-only implementation and npm instead of pnpm: current user
  direction.
