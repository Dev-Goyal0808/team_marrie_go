# Dhariya — Backend Product Services, Evidence, Routing, and Facility APIs

## Mission

Own and deliver three bounded backend product slices for AccessMap without
overlapping Sharad's active platform work, Dev2's place/matching work, or Dev's
browser implementation. Dhariya's work must provide tested server-side modules
that Sharad can integrate into the shared API entry point and contracts.

By the end of this task plan, AccessMap must have backend capabilities for:

- Safe evidence intake and privacy processing.
- Barrier incidents, access-graph enrichment, and constraint-aware routing.
- Facility operations, QR reporting context, civic API access, and webhook setup.

The product rule that must shape every implementation is:

> Unknown accessibility information must never be converted into a confirmed
> match, a safe route, or a universal accessibility score.

Dhariya is a backend developer. This plan deliberately gives Dhariya three
existing platform tickets, but keeps shared integration files with Sharad so
the work can proceed in a separate branch without overwriting Sharad's active
changes.

## Read before starting

Read these documents in order:

1. [`README.md`](../../README.md)
2. [`docs/PRODUCT_PLAN.md`](../PRODUCT_PLAN.md)
3. [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
4. [`docs/IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)
5. [`docs/tasks/sharad.md`](sharad.md)
6. [`docs/tasks/Dev.md`](Dev.md)
7. [`docs/tasks/Dev2.md`](Dev2.md)

## Ownership boundary

### Dhariya owns

```text
apps/api/src/evidence/**
apps/api/test/evidence/**
workers/evidence/**

apps/api/src/incidents/**
apps/api/test/incidents/**
apps/api/src/routing/**
apps/api/test/routing/**
packages/domain/src/routing/**
packages/domain/test/routing/**

apps/api/src/facility/**
apps/api/test/facility/**
apps/api/src/civic/**
apps/api/test/civic/**
apps/api/src/webhooks/**
apps/api/test/webhooks/**
```

Dhariya owns implementation and focused tests for `S-008`, `S-009`, and
`S-010`. The ticket IDs, dependencies, and product acceptance criteria remain
the same as in [`docs/tasks/sharad.md`](sharad.md).

### Sharad-owned integration and active-work paths

Do not edit these paths in Dhariya's branch:

```text
apps/api/src/server.mjs
apps/api/src/auth/**
apps/api/src/cache/**
apps/api/src/db/**
apps/api/test/auth/**
packages/contracts/**
packages/events/**
packages/validation/**
packages/domain/src/matching/**
supabase/**
infra/**
workers/** except workers/evidence/**
package.json
package-lock.json
scripts/**
```

In particular, `apps/api/src/server.mjs`, the database repository, auth
middleware, current cache implementation, migrations, shared contracts, and
event definitions are Sharad-owned integration points. Do not reformat,
reset, or replace active changes in those files. If a route, event, schema,
dependency, or migration is required, create a handoff request for Sharad.

### Other ownership boundaries

- Dev owns the browser and UI paths described in `Dev.md`.
- Dev2 owns `S-004` and `S-005` and their place/matching implementation paths.
- Sharad owns `S-001`, `S-002`, `S-003`, `S-006`, `S-007`, `S-011`, and `S-012`.
- Dhariya must not duplicate matching, trust, authorization, or database
  policy logic in a new module.

### Integration rule

Dhariya should implement composable services, handlers, ports, and tests under
the Dhariya-owned paths. When an endpoint needs registration in
`apps/api/src/server.mjs`, Dhariya must:

1. Export the handler or service with a documented input/output shape.
2. Add focused unit and adapter tests without editing the shared server file.
3. Record the exact route registration and dependency-injection change in the
   handoff.
4. Ask Sharad to wire the shared entry point and publish any contract change.

This prevents two branches from editing the same large API router.

## Dependencies and current state

- `S-001` provides the workspace and initial contract foundation.
- `S-002` provides the PostgreSQL/PostGIS tables and sample data.
- `S-003` provides the final authentication and authorization boundary.
- `S-004` and `S-005` are implemented by Dev2 and provide place, claim, match,
  and access-graph dependencies.
- `S-006` provides observations, claims, moderation, and verification data.
- `S-007` provides Redis, outbox, workers, live events, and delivery hooks.
- Sharad may have active uncommitted changes in shared API, database, auth,
  contract, event, and migration files. Dhariya must use a separate worktree
  and must not assume those files are safe to change.

If a dependency is not yet available, use an injected port or typed local test
double. Do not create a second database model, authorization system, event
name, or contract package inside Dhariya's scope.

## Low-conflict working agreement

### Branches and worktrees

Use a separate branch or worktree for every ticket:

```text
feature/dhariya/<ticket-id>-short-name
```

Do not develop in Sharad's dirty working directory. Before starting a ticket,
confirm that the worktree is clean and that the changed-file list does not
include another person's implementation.

### Commit rules

- One logical ticket per commit or small commit series.
- Use conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, or
  `refactor:`.
- Include the ticket ID in the commit body, for example `Refs: S-008`.
- Do not mix evidence, routing, and facility changes in one commit.
- Do not commit migrations, contract changes, or root dependency changes from
  Dhariya's branch.

### Backend safety rules

- PostgreSQL remains the source of truth.
- Use parameterized queries through Sharad's database boundary.
- Keep public serializers separate from private evidence, facility, and
  webhook-owner data.
- Never log raw uploads, evidence payloads, access tokens, webhook secrets,
  user emails, or private profile values.
- Use dependency-injected ports for storage, authorization, event publishing,
  routing providers, and webhook delivery.
- Unknown, stale, and conflicting accessibility claims remain unknown.
- Add tests for invalid input, authorization decisions, retries, idempotency,
  privacy, and dependency failure.

## Ticket board

Move every ticket through:

```text
NOT STARTED → IN PROGRESS → REVIEW → INTEGRATED → VERIFIED
```

Dhariya may mark a ticket `REVIEW` after the owned modules and tests pass.
`INTEGRATED` and `VERIFIED` require Sharad's shared-entry-point and real
dependency checks as described in the handoff.

| ID | Ticket | Depends on | Parallel with | Delivery gate |
| --- | --- | --- | --- | --- |
| S-008 | EvidenceGuard and secure media pipeline | S-003, S-007 | D-005 | Evidence is private until processing and moderation permit a public derivative. |
| S-009 | Barrier incidents, access graph, and routing API | S-004, S-005, S-007 | D-007 | Routes explain constraints, unknowns, freshness, and current barriers. |
| S-010 | Facility operations, QR workflow, civic API, and webhooks | S-006, S-007 | D-008 | Verified facilities and authorized civic consumers can act safely. |

---

## S-008 — EvidenceGuard and secure media pipeline

### Objective

Accept optional evidence without exposing private material, blocking the
durable observation lifecycle, or allowing an image to silently become an
accessibility claim.

### Owned implementation paths

```text
apps/api/src/evidence/**
apps/api/test/evidence/**
workers/evidence/**
```

### Required behavior

Implement a composable evidence pipeline:

```text
Upload intent
  → private object storage
  → signature and malware checks
  → EXIF removal
  → safe derivative
  → sensitive-content flags
  → alt-text suggestion
  → moderator review when needed
  → approved public derivative
```

Deliver:

- Upload intent and metadata validation.
- Private-original storage adapter.
- File signature, size, type, and malware-check ports.
- Idempotent processing state transitions.
- EXIF removal and derivative-generation adapter interfaces.
- Face, license-plate, document, and sensitive-text review flags.
- Alt-text suggestion and pending-description states.
- Public-derivative authorization that never exposes originals.
- Retry and abandoned-upload cleanup behavior.
- Failure behavior that leaves the observation available without evidence.

### Acceptance criteria

- Unsupported or malicious files are rejected before public use.
- Originals remain private and public URLs cannot access them.
- Public derivatives are not available before privacy processing succeeds.
- Processing retries do not create duplicate public derivatives.
- Sensitive evidence enters moderator review instead of being published.
- Evidence failure does not erase the related observation.
- Every approved public image has alt text or an explicitly pending description.
- AI or computer vision can flag content but cannot finalize an accessibility
  claim.
- The service does not log raw evidence or private storage locations.
- Route registration and contract changes are handed to Sharad rather than
  made in shared files.

### Required checks

- Unit tests for file type, size, signature, and metadata validation.
- Tests for private-original and approved-derivative separation.
- Retry/idempotency tests for each processing stage.
- Tests for sensitive-content hold and moderator-required states.
- Tests proving an evidence failure preserves the observation reference.
- Adapter tests using fake object storage and fake scanning providers.

---

## S-009 — Barrier incidents, access graph, and routing API

### Objective

Provide route and incident services that respect accessibility constraints,
current barriers, stale data, and unknown segments. A route is a recommendation
based on current information, not a guarantee of universal accessibility.

### Owned implementation paths

```text
apps/api/src/incidents/**
apps/api/test/incidents/**
apps/api/src/routing/**
apps/api/test/routing/**
packages/domain/src/routing/**
packages/domain/test/routing/**
```

### Required behavior

Implement behind injected repository, routing-engine, cache, and event ports:

- Incident create, update, resolve, and bounded listing services.
- Validation for place, access node, access edge, severity, dates, and status.
- Access-graph enrichment for entrances, lifts, toilets, crossings, and paths.
- Route request normalization and hard/soft constraint handling.
- Routing adapter interface for an external engine such as OSRM, Valhalla,
  or GraphHopper.
- Route enrichment with stairs, slope, surface, width, curb, lift, transport,
  stale, unknown, and active-barrier information.
- Versioned route-cache inputs and affected-route invalidation messages through
  Sharad's event/cache ports.
- Public incident payloads that exclude private moderator and contributor data.
- SSE-ready public update payloads without editing the existing SSE server.

### Acceptance criteria

- Invalid or unbounded route and incident requests are rejected clearly.
- A no-stairs request never returns a known-stairs-only route as suitable.
- Unknown or stale segments remain explicitly unknown or stale.
- Active barriers appear in route explanations with source and observation time.
- Incident resolution invalidates only affected route/cache scopes through the
  supplied port.
- Route results include distance, time, constraints, freshness, incidents, and
  uncertain segments.
- Routing-provider timeout and cache-unavailable states have safe recovery
  behavior.
- Public event payloads contain no private profile, email, or moderator data.
- The route service does not claim universal accessibility.

### Required checks

- Unit tests for route normalization and hard/soft constraints.
- Tests for stairs, slope, surface, width, lift, and unknown-segment rules.
- Incident lifecycle tests for create, update, resolve, and invalid input.
- Tests for stale and conflicting evidence.
- Tests for route-cache versioning and selective invalidation.
- Routing-provider timeout and Redis/cache failure tests.
- Contract examples and shared server registration requests in the handoff.

---

## S-010 — Facility operations, QR workflow, civic API, and webhooks

### Objective

Provide safe backend services for verified facility operators and authorized
civic consumers without allowing either group to delete or overwrite community
history.

### Owned implementation paths

```text
apps/api/src/facility/**
apps/api/test/facility/**
apps/api/src/civic/**
apps/api/test/civic/**
apps/api/src/webhooks/**
apps/api/test/webhooks/**
```

### Required behavior

Implement services and handler modules for:

- Facility claim request and approved-facility listing.
- Facility-scope checks through Sharad's authorization port.
- Official responses kept separate from community observations.
- Incident acknowledgement and repair/resolution updates.
- QR creation with signed, non-private context payloads.
- QR context validation for facility, entrance, lift, toilet, stop, or feature.
- Versioned civic read APIs for approved public place and incident data.
- Civic pagination, bounded filters, and rate-limit integration ports.
- Webhook subscription validation, event selection, signing, replay protection,
  pause/revoke behavior, and delivery-status adapters.
- Redacted delivery logs and idempotency keys for webhook attempts.

### Acceptance criteria

- Unverified facility users cannot publish official responses.
- Verified managers can act only on approved facilities in their scope.
- Community observations cannot be deleted through facility operations.
- Facility responses include source and date and remain separate from claims.
- QR payloads cannot select unauthorized private data or arbitrary records.
- Civic APIs expose only approved public data and enforce pagination/rate limits.
- Webhook secrets are never returned after creation in full.
- Webhook payloads contain only authorized public events.
- Delivery retries are idempotent and expose failure state to authorized owners.
- Shared auth, event, contract, and worker integration changes are listed in
  the handoff for Sharad.

### Required checks

- Facility role and facility-scope authorization tests using injected ports.
- Tests proving community observations cannot be deleted or rewritten.
- QR signing, tamper detection, expiry, and context-validation tests.
- Civic pagination, filtering, public-visibility, and rate-limit tests.
- Webhook secret redaction, signature, replay, retry, and idempotency tests.
- Tests for event-delivery failure and safe recovery.

---

## Handoff to Sharad and Dev

At the end of each ticket, provide:

- Changed implementation and test paths.
- Exact files intentionally not changed because they are Sharad-owned.
- Contract or fixture requests, without editing `packages/contracts/**` directly.
- Database table and query assumptions.
- Authorization and event-port assumptions.
- Cache, idempotency, retry, and version behavior.
- Exact local commands and results.
- Route registration or worker wiring required from Sharad.
- Dev-facing endpoint examples and failure-state behavior.
- Known limitations and remaining dependency on S-003, S-006, or S-007.

Dev must render the server's explanation and status. Dev must not duplicate
route safety, evidence privacy, facility authorization, or webhook trust rules
in the browser.

## Dhariya daily checklist

Before coding:

- [ ] Read the ticket and dependency status.
- [ ] Create a clean `feature/dhariya/<ticket-id>-short-name` branch/worktree.
- [ ] Run `git status --short` and confirm Sharad's active files are untouched.
- [ ] Confirm the current contract and fixture versions.
- [ ] Confirm the database, auth, cache, and event ports available for use.
- [ ] Identify privacy, authorization, retry, and failure states.

During coding:

- [ ] Keep implementation inside the Dhariya-owned paths.
- [ ] Use parameterized queries and injected dependencies.
- [ ] Keep private and public serializers separate.
- [ ] Preserve unknown, stale, conflicting, and pending states.
- [ ] Add unit, adapter, contract-example, and integration-boundary tests.
- [ ] Never log secrets, raw evidence, private profiles, or private payloads.
- [ ] Do not edit `apps/api/src/server.mjs` to register a new route.

Before handoff:

- [ ] Run the focused ticket tests.
- [ ] Run `npm test` when the worktree has the required dependencies.
- [ ] Run `npm run lint` when the worktree has the required dependencies.
- [ ] Run the relevant database or service integration check.
- [ ] Test dependency failure, retry, and idempotency behavior.
- [ ] Publish endpoint examples and the exact integration request for Sharad.
- [ ] Confirm `git diff --name-only` contains no Sharad-owned path.

## Dhariya-to-Sharad handoff template

````markdown
### Ticket
S-___

### Delivered
- ...

### Dhariya-owned files changed
- ...

### Sharad-owned files intentionally not changed
- ...

### API/event/worker integration request
- ...

### Contract and fixture assumptions
- ...

### Database and authorization assumptions
- ...

### Tests and exact results
- Command:
- Result:

### Privacy and failure-state checks
- ...

### Remaining work for integration
- ...
````
