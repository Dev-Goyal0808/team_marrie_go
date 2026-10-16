# Dev2 — Place API and Accessibility Matching Backend Plan

## Mission

Deliver the backend capabilities that the completed AccessMap web experience
needs first: public place discovery and the private, explainable Accessibility
Match Profile engine.

This plan transfers `S-004` and `S-005` from `docs/tasks/sharad.md` without
changing their ticket IDs, dependencies, contracts, or acceptance criteria.
The ticket IDs remain stable so the existing Dev frontend plan can continue to
refer to `S-004` and `S-005`.

The product rule that must not be violated is:

> AccessMap must never turn unknown accessibility information into a confirmed
> match or a universal accessibility score.

## Read before starting

Read these documents in order:

1. [`README.md`](../../README.md)
2. [`docs/PRODUCT_PLAN.md`](../PRODUCT_PLAN.md)
3. [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
4. [`docs/IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)
5. [`docs/tasks/sharad.md`](sharad.md)
6. [`docs/tasks/Dev.md`](Dev.md)

## Scope and ownership

Dev2 owns only the implementation and tests for:

```text
apps/api/src/places/**
apps/api/src/matches/**
apps/api/test/places/**
apps/api/test/matches/**
packages/domain/src/matching/**
```

Dev2 does not own or modify these areas without an explicit contract-change
agreement with Sharad:

```text
supabase/**                 # database migrations, RLS, and seed data
apps/api/src/auth/**        # authentication and authorization middleware
workers/**                  # outbox publishers and worker consumers
packages/contracts/**       # shared API schemas and fixtures
packages/events/**          # event names and envelopes
infra/**                    # local and deployment infrastructure
```

If an endpoint needs a response-shape change, update the shared contract first,
add or update its fixture and contract test, and notify Sharad before changing
the implementation. Dev2 must use Sharad's database and authorization
boundaries rather than bypassing them.

## Dependencies and current state

- `S-001` foundation and initial contracts are available in the workspace.
- `S-002` PostgreSQL/PostGIS migration and seed verification has passed through
  `scripts/run-s002-db-check.sh` against the local disposable database.
- `S-003` authentication, authorization, and security controls remain Sharad's
  dependency. Dev2 must keep the endpoint behavior compatible with its final
  session and role checks.
- `S-007` owns shared Redis/Valkey infrastructure, outbox processing, and cache
  invalidation workers. Dev2 may use a cache adapter and define the required
  key/version behavior, but does not implement those workers here.

## Delivery rules

- Use a separate branch or worktree such as
  `feature/dev2/S-004-S-005-place-match-api`.
- Keep PostgreSQL/PostGIS as the source of truth.
- Keep public serializers separate from private profile serializers.
- Never log raw profile requirements, email addresses, diagnosis-like data, or
  private request payloads.
- Unknown, stale, and conflicting claims must remain unknown for matching.
- Add focused unit, contract, and integration tests with each endpoint or rule.
- Do not mark a ticket `VERIFIED` until its acceptance checks have run.

## Ticket board

Move each ticket through:

```text
NOT STARTED → IN PROGRESS → REVIEW → INTEGRATED → VERIFIED
```

| ID | Ticket | Depends on | Frontend dependency | Delivery gate |
| --- | --- | --- | --- | --- |
| S-004 | Place directory and geospatial API | S-002, S-003 | D-002 | Search and place details are real and paginated. |
| S-005 | Accessibility Match Profile engine | S-002, S-003 | D-003 | Required/preferred/avoid results are deterministic. |

---

## S-004 — Place directory and geospatial API

### Objective

Provide real, paginated, cacheable APIs for search, map/list results, and place
details.

### Endpoints

```text
GET /api/places
GET /api/search
GET /api/places/:placeId
GET /api/places/:placeId/claims
GET /api/places/:placeId/incidents
GET /api/places/:placeId/access-graph
GET /api/categories
GET /api/features
```

### Required behavior

- Search by name, category, city, coordinate radius, and bounding box.
- Paginate every collection.
- Sort by distance and freshness.
- Return list-safe summaries without requiring map rendering.
- Exclude inactive, duplicate, hidden, and unapproved records.
- Normalize and validate coordinates, radius, page size, feature codes, and
  category codes.
- Use PostGIS for distance and geometry operations through Sharad's database
  boundary.
- Use Redis cache-aside with bounded keys and TTLs when the shared cache
  adapter is available.
- Fall back to PostgreSQL if Redis is unavailable.

### Acceptance criteria

- Search results are deterministic for the same data and request.
- Out-of-range requests are rejected with useful errors.
- Map bounding-box searches do not return unbounded data.
- The list result contains every field Dev needs for a result card.
- Place details include claims, dates, source labels, active incidents, and
  match-ready data.
- Cache misses preserve semantic correctness.
- Integration tests cover PostGIS and Redis fallback behavior.

### Required checks

- Contract fixtures cover a place summary, place detail, paginated collection,
  claims, incidents, access graph, categories, and features.
- Unit tests cover coordinate, radius, bounding-box, page-size, category, and
  feature validation.
- Integration tests run against the seeded PostGIS database.
- A cache-unavailable test proves that PostgreSQL results remain correct.

---

## S-005 — Accessibility Match Profile engine

### Objective

Implement the explainable matching layer that compares a private user profile
with current facility claims. This is a core product feature, not a cosmetic
score.

### Profile model

Each selected feature has one level:

- `required`
- `preferred`
- `avoid`

The profile is private, versioned, and validated against active feature codes.

### Endpoints

```text
GET   /api/me/access-match-profile
PATCH /api/me/access-match-profile
GET   /api/places/:placeId/match
POST  /api/matches/places
```

`POST /api/matches/places` may support anonymous one-request comparisons. It must
not persist the profile or log raw profile values.

### Deterministic rules

1. A recent positive claim is a confirmed match.
2. A recent negative or temporary-unavailability claim is a known barrier.
3. Missing, stale, or materially conflicted data is unknown.
4. Unknown required features never count as confirmed.
5. Preferred unknown features do not block the result.
6. A known avoid-condition creates an avoidance warning.
7. `meets_known_requirements` is allowed only when every required item is
   confirmed and no required item has an active barrier.
8. Never return a universal accessibility score.

### Match response

Return:

- Decision: `meets_known_requirements`, `partial`,
  `needs_more_information`, `known_barrier`, or `no_profile`.
- Required totals: total, confirmed, barriers, unknown.
- Preferred totals.
- Avoidance warnings.
- Per-feature explanation.
- Claim status and observation date.
- Claims version and calculation version.

### Caching and privacy

Use a server-generated profile hash and claims version:

```text
accessmap:match:{placeId}:{claimsVersion}:{profileHash}
```

Never put raw profile JSON, user email, or diagnosis-like data into the key,
value, logs, analytics, or error messages.

### Acceptance criteria

- Matching is a pure, deterministic function over a profile snapshot and claims
  snapshot.
- Required, preferred, and avoid semantics are covered by unit tests.
- A required unknown produces `needs_more_information`.
- A known barrier never counts as a confirmed match.
- A preferred unknown remains visible but does not block.
- Match explanations point to the underlying claim source and date.
- Profile changes and claim changes invalidate or version affected match results.
- No endpoint exposes the complete private profile to public callers.

### Required checks

- Unit tests cover no profile, required, preferred, avoid, confirmed, barrier,
  stale, conflicted, and unknown states.
- Tests prove that a required unknown cannot produce
  `meets_known_requirements`.
- Tests prove that raw profile values do not appear in cache keys, logs, or
  public responses.
- Authenticated profile reads and writes are checked against the S-003 session
  boundary.
- Anonymous one-request comparisons prove that the profile is not persisted.

---

## Handoff to Sharad and Dev

At the end of each ticket, provide:

- Changed implementation and test paths.
- Contract and fixture version.
- Required database/query assumptions.
- Cache key and claims/profile version behavior.
- Exact local commands and results.
- Known limitations or remaining dependency on S-003 or S-007.

Dev can integrate the endpoints only after the contract fixtures and response
examples are published. Dev must continue rendering the server's explanation
and must not duplicate match or trust rules in the browser.

## Dev2 daily checklist

Before coding:

- [ ] Read `S-002`, `S-003`, `S-004`, and `S-005` dependencies.
- [ ] Confirm the contract version and existing fixture shapes.
- [ ] Create a separate branch or worktree.
- [ ] Confirm no migration, auth, worker, or infrastructure change is needed.

During coding:

- [ ] Validate at the API boundary.
- [ ] Keep business logic in domain/application modules, not route handlers.
- [ ] Add public/private serializers.
- [ ] Keep unknown and stale states explicit.
- [ ] Add tests for success, invalid input, privacy, and fallback behavior.

Before handoff:

- [ ] Run the focused ticket tests.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run the S-002 database check when database behavior is involved.
- [ ] Publish contract fixtures and the exact API run command.
