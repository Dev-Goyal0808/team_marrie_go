# AccessMap Implementation Plan

## Document purpose

This document turns the product and architecture plans into a delivery sequence. It covers discovery, design, engineering, data preparation, testing, deployment, pilot launch, and ongoing operations.

The plan is intentionally organized around complete vertical slices. Each phase should finish with something a user or moderator can actually test, rather than building disconnected backend and frontend layers for a long period.

## Delivery strategy

### First release objective

Deliver a mobile-first web application in which a person can:

1. Search for a nearby public facility.
2. Filter it using specific accessibility needs.
3. Read feature-level, dated information.
4. Understand what is known, unknown, stale, or disputed.
5. Request a route using accessibility constraints.
6. See current barriers and receive a live update when a relevant incident changes.
7. Submit an observation or barrier report, including while offline.
8. See the report moderated and represented in the directory.
9. Confirm or dispute another observation.

### Suggested release shape

The exact calendar depends on team size, but the following sequence works for a small product team or challenge project:

| Phase | Focus | Suggested duration |
| --- | --- | ---: |
| 0 | Discovery, scope, and partner validation | 1–3 days |
| 1 | Design system, platform foundation, Redis, and workers | 3–5 days |
| 2 | Places, search, map, and list | 3–5 days |
| 3 | Place details and Accessibility Match Profile | 3–5 days |
| 4 | Observations, offline sync, and EvidenceGuard | 5–7 days |
| 5 | Verification, live incidents, and event-driven updates | 5–7 days |
| 6 | Barrier-aware routing and route explanations | 5–8 days |
| 7 | Facility operations, QR workflows, and civic API | 4–6 days |
| 8 | Accessibility, security, performance, and release | 4–6 days |
| 9 | Pilot launch and feedback loop | Ongoing |

These estimates are planning aids, not promises. Scope should be reduced before quality is reduced.

## Phase 0 — Discovery and definition

### Objectives

- Validate that the taxonomy reflects real user decisions.
- Agree on the pilot geography and facility categories.
- Define the verification and moderation language.
- Identify organizations or people who can review accessibility and safety decisions.

### Activities

1. Interview people with different access needs.
2. Interview facility managers and local community organizations.
3. Review existing public facility data sources.
4. Select the first facility categories.
5. Identify the most important features for the pilot.
6. Test the difference between “unknown”, “unavailable”, “temporary”, and “stale”.
7. Decide how contributor identity and account deletion should work.
8. Write a moderation and privacy policy before collecting real reports.

### Deliverables

- Approved product brief.
- Pilot location and facility list.
- Accessibility feature taxonomy v1.
- User-flow sketches.
- Verification vocabulary.
- Data privacy decisions.
- Initial acceptance criteria.
- List of disability-led reviewers and pilot partners.

### Exit criteria

- At least one disabled-user review has informed the taxonomy.
- The team can explain the difference between an observation and a claim.
- The MVP does not depend on an ambiguous overall accessibility score.
- The team knows who will moderate early reports.

## Phase 1 — Design system and technical foundation

### Product work

- Create accessible color, typography, spacing, and focus tokens.
- Design mobile and desktop layouts.
- Define semantic headings and landmarks.
- Design form errors, loading states, empty states, and conflicts.
- Create a status-label component that never relies on color alone.
- Design the accessible list alternative to the map.
- Write plain-language interface copy.

### Engineering work

- Initialize the Next.js and TypeScript application.
- Configure linting, formatting, type checking, and test tooling.
- Create shared domain types and validation schemas.
- Create shared requirement-level and match-result types.
- Create the Supabase project or equivalent backend environments.
- Add local PostgreSQL/PostGIS and Redis/Valkey services through Docker Compose.
- Add the first database migration.
- Configure authentication.
- Add environment variable validation.
- Add local seed data.
- Create shared event envelope and event-name contracts.
- Create the transactional outbox table and publisher skeleton.
- Create worker and scheduler processes.
- Add queue retry, dead-letter, and idempotency conventions.
- Add preview deployment.
- Add error monitoring in non-production mode.

### Foundation acceptance criteria

- A developer can start the application using documented commands.
- A clean database can apply all current migrations.
- A seed script creates example places and features.
- Public and authenticated routes have separate test identities.
- A local worker can consume a test event from Redis/Valkey.
- An observation and its outbox event commit atomically in a test transaction.
- A retrying worker does not duplicate an idempotent side effect.
- CI runs lint, typecheck, tests, and a production build.
- The UI shell passes a keyboard-only smoke test.

## Phase 2 — Places, search, map, and list

### User-visible work

- Home page search.
- Category browse.
- Manual location search.
- Optional current-location search.
- Radius and bounding-box queries.
- Map view.
- Accessible list view.
- Result cards with distance and data freshness.
- Empty and error states.

### Backend work

- Create place and category tables.
- Add PostGIS geography column and indexes.
- Create public search endpoint.
- Add geocoding service interface.
- Add place detail endpoint.
- Validate and normalize search parameters.
- Add duplicate detection for imported or suggested places.

### Test scenarios

- Search by exact facility name.
- Search by category and city.
- Search around a coordinate.
- Search without location permission.
- Search with an invalid coordinate.
- Search with no results.
- Use list view without loading the map.
- Open a place from the result list.
- Confirm that inactive or duplicate places do not appear publicly.

### Exit criteria

A user can search, browse, and open a real place page using either the map or a fully usable list.

## Phase 3 — Place details and Accessibility Match Profile

### User-visible work

- Place identity and contact information.
- Opening hours.
- Accessibility feature sections.
- Not-assessed state.
- Source and observation dates.
- Basic status labels.
- Optional Accessibility Match Profile onboarding.
- Required, preferred, and avoid requirement levels.
- Match summaries such as confirmed requirements, known barriers, and unknown requirements.
- Expandable explanation of the claims behind a match result.
- Manual feature filters.
- Match, unknown, and conflict summaries.

### Backend work

- Create accessibility feature taxonomy.
- Create private user profile table.
- Create claim summary table or view.
- Add feature filtering.
- Add freshness calculation.
- Add match-profile validation and private profile versioning.
- Implement deterministic matching engine as a pure application service.
- Add anonymous one-request matching without persistence.
- Add match-result cache keyed by profile hash and claims version.
- Invalidate or version match results after claim, incident, or profile changes.
- Exclude private preferences from public serializers and logs.

### Test scenarios

- User skips preference onboarding.
- User selects, edits, and clears preferences.
- User sees unknown information separately from unavailable information.
- User searches manually without creating an account.
- Public API cannot read another user's profile.
- A stale claim shows its date and re-verification message.
- User marks features as required, preferred, or avoid.
- A place with all required features confirmed shows the expected match explanation.
- A place with an unknown required feature is labeled as needing more information, not as a full match.
- A known barrier is not counted as a confirmed requirement.
- A preferred unknown does not block a place but remains visible.
- A match explanation opens the underlying claim status and observation date.
- Profile values do not appear in logs, public serializers, or shared cache values.

### Exit criteria

A person can make a useful decision from a place page even when the place has incomplete information, and can compare that information against private requirements without being assigned a universal accessibility score.

## Phase 4 — Community observations, offline sync, and EvidenceGuard

### User-visible work

- Sign-in or email/OTP flow.
- Report an issue action.
- Report a positive feature action.
- Feature-specific structured form.
- Observation date.
- Status selection.
- Optional details and measurements.
- Optional photo upload.
- Privacy warning before upload.
- Submission confirmation.
- Contribution history.
- Offline report draft and local sync state.
- Retry and duplicate-prevention feedback.
- Evidence processing status.

### Backend work

- Create observation table.
- Add server-side schema validation.
- Add rate limits.
- Add evidence storage and metadata stripping.
- Add private upload flow.
- Add moderation status.
- Add user-owned contribution queries.
- Add report correction and deletion request behavior.
- Add service worker and IndexedDB report outbox.
- Add client-generated idempotency keys.
- Add offline synchronization endpoint and reconciliation.
- Add Redis-backed sync queue.
- Add EvidenceGuard worker for file scanning, EXIF removal, derivatives, and privacy flags.
- Add optional alt-text and feature suggestions for moderator review.

### Test scenarios

- Valid report is stored and can be read back.
- Required fields produce useful errors.
- The form keeps entered data after a validation failure.
- A user can submit without a photo.
- An invalid file is rejected.
- A photo is not publicly available before approval.
- A user can see their own pending report but not another user's pending report.
- Rate limits prevent rapid duplicate abuse.
- A failed request does not falsely show “submitted”.
- A report can be saved locally without network access.
- Reconnecting syncs the report once even if the client retries.
- A user can distinguish locally saved, syncing, confirmed, and failed states.
- An evidence-processing delay does not erase the observation record.
- A public image derivative is unavailable until privacy processing succeeds.

### Exit criteria

The application supports a complete, server-confirmed reporting flow from the user interface through storage and back to the place page or contribution history, including a recoverable offline path.

## Phase 5 — Verification, live incidents, and event-driven updates

### User-visible work

- Confirm action.
- Dispute action.
- Mark outdated action.
- Claim-level status summary.
- Supporting and disputing counts where appropriate.
- Conflict warning.
- Freshness and re-verification status.
- Moderation queue.
- Moderator detail and action view.
- Live barrier incidents linked to places, features, access nodes, or route segments.
- Incident lifecycle: reported, validated, published, disputed, resolved, archived.
- Live place updates through Server-Sent Events.

### Backend work

- Create verification-event table.
- Implement deterministic claim aggregation.
- Add independence rules.
- Add conflict detection.
- Add scheduled freshness job.
- Add moderation-item table and queue.
- Add audit logs for privileged actions.
- Add moderation permissions.
- Add barrier incident table and lifecycle.
- Add transactional outbox publisher.
- Add Redis Streams or BullMQ consumers.
- Add claim, cache, and notification workers.
- Add Redis-backed rate limiting, locks, and idempotency.
- Add SSE stream for approved public place and incident changes.
- Add route-invalidation event contract for the next phase.

### Initial aggregation behavior

1. Approved observation creates a reported claim.
2. Two independent agreeing observations create a corroborated claim.
3. Recent temporary-unavailability claims are displayed prominently.
4. Materially different recent observations create a conflict state.
5. Old observations become stale or need re-verification.
6. Facility confirmation is presented as a separate source.

### Test scenarios

- One report produces the expected reported state.
- Two independent reports produce corroboration.
- A user cannot confirm their own observation when independence is required.
- A conflicting recent report produces a visible conflict.
- Rejected or hidden reports do not support the public claim.
- A stale report changes freshness state.
- Re-running aggregation produces the same result.
- A moderator approval changes public visibility and creates an audit entry.
- Moderator notes are not visible to public users.
- An approved incident updates the affected place without deleting its permanent feature record.
- A resolved incident remains visible in history with its resolution time.
- A committed observation produces a downstream event exactly once from the consumer's perspective.
- Redis cache loss falls back to PostgreSQL without changing public meaning.
- A relevant open place receives an accessible live-update announcement.

### Exit criteria

The directory can show not only what a community member said, but how much independent, recent, and moderated support the current claim has, while current incidents propagate through the event pipeline.

## Phase 6 — Barrier-aware routing and route explanations

### User-visible work

- Route request from an origin to a place or access node.
- Private route constraints such as avoiding stairs or limiting slope.
- Multiple route alternatives with distance and time.
- Segment-level warnings for active barriers, stale data, and unknown access.
- Accessible route explanation in list form as well as on the map.
- Recalculate action when a live incident affects an open route.

### Backend work

- Add `access_nodes` and `access_edges` migrations.
- Create a routing-engine adapter.
- Normalize route profiles and hard/soft constraints.
- Enrich base routes with AccessMap observations and active incidents.
- Add Redis route-result cache with a graph/incident version in the key.
- Add route invalidation worker for affected edges and cells.
- Add route calculation metrics and trace propagation.

### Test scenarios

- A route can avoid stairs when stairs are a hard constraint.
- A route shows unknown segments rather than treating them as accessible.
- An active barrier invalidates an affected route cache but not unrelated routes.
- A route response includes calculation time, data freshness, and constraint explanation.
- A user can recalculate after a live update without losing preferences.
- The list explanation is usable without map interaction.

### Exit criteria

A user can choose a route based on their own constraints and understand the evidence and uncertainty behind that recommendation.

## Phase 7 — Facility responses, QR workflows, and civic API

### User-visible work

- Facility claim request.
- Moderator verification of official contact.
- Facility dashboard.
- Official response to a feature or barrier.
- Temporary closure or repair update.
- Separate facility-confirmed label.
- QR codes associated with a facility entrance, feature, or access node.
- Barrier acknowledgement and resolution timeline.
- Public incident and change-feed API.
- Notification or in-app update where practical.

### Backend work

- Create facility claim and response tables.
- Add role checks.
- Add claim approval and revocation.
- Prevent facility users from deleting community observations.
- Add notification records.
- Add audit logs for facility actions.
- Add QR-code creation and lookup.
- Add versioned `/api/v1` public endpoints.
- Add API-key and webhook subscription controls.
- Add webhook retry and dead-letter behavior.

### Test scenarios

- Unverified manager cannot publish an official response.
- Verified manager can respond only for approved places.
- Facility response appears separately from community evidence.
- Facility response cannot delete independent observations.
- Revoked facility access blocks future edits.
- A QR code opens a feature-specific report form.
- A public API returns approved active incidents without private data.
- A failed webhook retries with backoff and becomes visible to operators.

### Exit criteria

Facility participation improves the directory without changing its independence or transparency model, while the civic API makes approved changes useful to external organizations.

## Phase 8 — Accessibility, security, performance, and release hardening

### Accessibility work

- Keyboard-only audit.
- Screen-reader audit.
- 200% zoom and text-resize test.
- High-contrast and forced-color test.
- Reduced-motion test.
- Touch target review.
- Form error recovery test.
- Map alternative test.
- Test with disabled users or disability-led organizations.

### Security work

- Review row-level security policies.
- Test role escalation.
- Test private profile access.
- Test evidence storage access.
- Check file type validation and malware scanning.
- Review XSS, CSRF, injection, and open-redirect protections.
- Add rate limits to authentication, reporting, uploads, and verification.
- Remove secrets and sensitive payloads from logs.

### Performance work

- Measure public place page load.
- Measure search latency.
- Measure route latency and route-cache hit ratio.
- Verify text results render before map assets.
- Optimize image derivatives.
- Add appropriate caching and invalidation.
- Test slow network and intermittent connectivity.
- Measure Redis cache hit ratio, queue lag, dead-letter jobs, and route invalidation delay.
- Test worker restart, Redis reconnect, and PostgreSQL fallback behavior.

### Release acceptance

- All P0 product criteria pass.
- Critical keyboard and screen-reader flows pass.
- No known critical privacy or authorization flaw remains open.
- Database backup and restore process is documented and tested.
- Production smoke test is written.
- Moderator and incident-response owners are known.
- Worker queues, Redis alerts, and dead-letter handling are visible to operators.
- Offline sync, live incident, and route recalculation flows pass on a mobile test device.

## Phase 9 — Pilot launch and feedback loop

### Pilot scope

Start with one city, district, or campus and a limited set of facility categories. Prioritize locations people regularly need:

- Healthcare
- Government services
- Libraries
- Transport stops
- Community centers
- Parks
- Public toilets
- Education and cultural facilities

### Pilot preparation

1. Seed high-priority public places.
2. Invite disability organizations to review place data.
3. Train moderators on privacy and conflict handling.
4. Invite selected facility managers.
5. Recruit community contributors.
6. Publish the verification explanation.
7. Set up feedback and issue-reporting channels.
8. Establish a schedule for reviewing stale claims.
9. Seed access nodes, route segments, and initial known barriers for pilot locations.
10. Test live incidents and offline reports with pilot participants.
11. Measure route warnings, synchronization reliability, queue lag, and incident resolution.

### Pilot review cadence

- Daily during the first launch week: errors, abuse, failed reports, and urgent access barriers.
- Weekly: moderation backlog, stale claims, conflicts, facility responses, and user feedback.
- Monthly: coverage, report quality, accessibility issues, and product priorities.

## Work breakdown structure

### Product and design

- [ ] Confirm target pilot area.
- [ ] Confirm primary personas.
- [ ] Review taxonomy with disabled users.
- [ ] Define status wording.
- [ ] Write moderation policy.
- [ ] Write privacy and evidence policy.
- [ ] Design search, list, map, place, preferences, report, and moderation flows.
- [ ] Design every empty, invalid, loading, stale, conflict, and error state.
- [ ] Produce accessible content guidelines.

### Data and backend

- [ ] Create categories and feature taxonomy seed data.
- [ ] Create database migrations.
- [ ] Add PostGIS indexes.
- [ ] Create search queries.
- [ ] Create claim aggregation function.
- [ ] Create freshness job.
- [ ] Create authentication and role checks.
- [ ] Add observation validation.
- [ ] Add evidence storage.
- [ ] Add moderation queue and audit logs.
- [ ] Add facility claims and responses.
- [ ] Add Redis/Valkey connection, namespacing, ACL, and TTL policy.
- [ ] Add transactional outbox and event envelope.
- [ ] Add worker consumer groups and dead-letter handling.
- [ ] Add distributed rate limits, locks, and idempotency.
- [ ] Add access nodes, edges, and barrier incidents.
- [ ] Add route engine adapter and route cache invalidation.
- [ ] Add SSE event stream.
- [ ] Add offline sync endpoint and reconciliation rules.
- [ ] Add EvidenceGuard processing worker.
- [ ] Add public API versioning and webhook delivery.

### Frontend

- [ ] Create accessible application shell.
- [ ] Create search and filter controls.
- [ ] Create result cards.
- [ ] Create map and list views.
- [ ] Create place detail feature sections.
- [ ] Create status and freshness components.
- [ ] Create Accessibility Match Profile form.
- [ ] Create required/preferred/avoid controls.
- [ ] Create match summary cards and explanation drawer.
- [ ] Create observation form.
- [ ] Create upload and privacy guidance.
- [ ] Create contribution history.
- [ ] Create moderator queue.
- [ ] Create facility dashboard.
- [ ] Create route constraints and route explanation views.
- [ ] Create live incident announcements and recalculation actions.
- [ ] Create offline report queue and sync states.
- [ ] Create QR-specific reporting entry point.
- [ ] Create civic API documentation or developer page.

### Quality

- [ ] Add unit tests for status and freshness logic.
- [ ] Add integration tests for search and data persistence.
- [ ] Add end-to-end tests for the core journeys.
- [ ] Add accessibility automation.
- [ ] Perform keyboard and screen-reader audits.
- [ ] Perform security review.
- [ ] Test responsive layouts and slow networks.
- [ ] Test backups and restore.
- [ ] Test Redis failure and PostgreSQL fallback.
- [ ] Test queue retry and dead-letter behavior.
- [ ] Test duplicate offline sync.
- [ ] Test live SSE updates.
- [ ] Test route constraints and invalidation.
- [ ] Test evidence privacy processing.
- [ ] Test webhook signing and retry behavior.

## Testing strategy

### Unit tests

Cover pure and deterministic logic:

- Feature filter matching.
- Accessibility Match Profile evaluation.
- Required versus preferred versus avoid semantics.
- Unknown, stale, conflicting, and temporary claims in match results.
- Match explanation and profile-hash normalization.
- Unknown versus unavailable behavior.
- Freshness windows.
- Claim aggregation.
- Conflict detection.
- Duplicate detection normalization.
- Coordinate and radius validation.
- Role and action authorization helpers.
- Observation and measurement schemas.

### Integration tests

Cover real module boundaries:

- Search endpoint to PostGIS query.
- Place detail endpoint to claims and observations.
- Match endpoint to private profile and current claim snapshot.
- Match-result cache invalidation after claim or profile change.
- Observation submission to persisted record.
- Evidence upload to private storage.
- Moderation action to public visibility.
- Verification event to claim recomputation.
- Facility response to approved facility claim.
- Row-level security for private data.
- Observation transaction to outbox event.
- Redis cache miss and PostgreSQL fallback.
- Worker retry to idempotent side effect.
- Barrier incident to claim, cache, and route invalidation.
- Offline sync request to one persisted observation.
- Evidence upload to private derivative and moderation state.
- SSE subscription to approved public incident event.

### End-to-end tests

The minimum Playwright-style flows should include:

1. Search by category and location.
2. Use list view without map interaction.
3. Create an Accessibility Match Profile.
4. Apply required, preferred, and avoid requirements.
5. Open a place detail page and inspect the match explanation.
6. Sign in and submit an observation.
7. Confirm another observation.
8. Dispute an observation and see conflict status.
9. Moderate a report.
10. Claim a facility as a manager.
11. Publish a facility response.
12. Request a route with an accessibility constraint.
13. Receive a live incident and recalculate the route.
14. Submit a report offline and synchronize after reconnecting.
15. Open a QR-specific report form.

### Accessibility testing

Automated checks are useful but insufficient. Combine:

- axe checks for rendered pages.
- Lighthouse or equivalent checks.
- Keyboard-only completion.
- Screen-reader navigation.
- Zoom and text-resize testing.
- Reduced-motion and forced-color testing.
- Manual label, focus, error, and announcement review.
- Testing with disabled people and disability-led organizations.

### Security testing

- Public users cannot read private profiles.
- Contributors cannot edit other contributors' records.
- Facility managers cannot edit unclaimed places.
- Facility managers cannot delete community history.
- Moderators cannot expose private evidence through public URLs.
- Uploads cannot bypass file rules.
- Rate limits work on abuse-prone endpoints.
- Sensitive values are absent from logs and analytics.
- Redis credentials and private keys are not exposed to the browser.
- Queue messages do not contain raw private evidence or access profiles.
- Webhook signatures cannot be forged or replayed indefinitely.
- SSE streams expose only public events within the authorized subscription.

### Resilience and load testing

- Measure search, place, and route p95 latency.
- Measure Redis cache hit ratio and database fallback latency.
- Load test report submission and claim recomputation workers.
- Verify backpressure when evidence uploads exceed worker capacity.
- Restart a worker while jobs are pending and verify safe redelivery.
- Disconnect Redis and verify the user receives a recoverable degraded state.
- Simulate many simultaneous SSE subscribers and bounded subscription cleanup.

## CI/CD plan

Every pull request should run the project's actual configured commands. A recommended initial pipeline is:

```text
install dependencies
run lint
run typecheck
run unit tests
run integration tests
run end-to-end smoke tests
run accessibility checks
build production bundle
start worker smoke test
run migration and Redis health checks
```

The project should document the final command names in the root README after initialization. CI should fail on lint, type errors, failing tests, or a production build failure.

### Pull request process

1. Create a focused branch.
2. Add or update acceptance tests.
3. Run local checks.
4. Open a pull request.
5. Review the preview deployment.
6. Perform a keyboard and responsive smoke test for UI changes.
7. Review migration, event schema, Redis key/TTL changes, and worker retry behavior.
8. Merge only after required checks pass.

## Deployment and release process

### Environments

#### Local

Docker Compose with the web app, PostgreSQL/PostGIS, Redis/Valkey, worker, scheduler, MinIO or equivalent object storage, and Mailpit. Use seeded example data and development accounts only.

#### Preview

Pull-request web deployment with a safe Redis namespace or preview instance, test worker smoke processing, safe test data, and no production secrets.

#### Staging

Production-like web and worker deployments, database, Redis, storage policy, queue metrics, tracing, and monitoring configuration.

#### Production

Containerized stateless web service, separately scalable workers, managed PostgreSQL/PostGIS, managed Redis/Valkey, object storage, restricted secrets, backups, monitoring, migration approval, and operational ownership.

### Release checklist

- [ ] Product acceptance criteria reviewed.
- [ ] Database migration tested on a copy of staging.
- [ ] Redis key, TTL, memory, ACL, and failure behavior reviewed.
- [ ] Worker migration and queue compatibility checked.
- [ ] Backup completed.
- [ ] Rollback or forward-fix plan documented.
- [ ] Accessibility smoke test completed.
- [ ] Security-sensitive changes reviewed.
- [ ] Production environment variables verified.
- [ ] Deployment completed.
- [ ] Smoke test passed.
- [ ] Error and uptime monitoring checked.
- [ ] Queue lag, dead-letter jobs, cache hit ratio, and worker health checked.
- [ ] Release notes written.

## Operations and monitoring

### Technical signals

- Server error rate.
- Search latency and failure rate.
- Report submission failure rate.
- Image processing failures.
- Authentication failures.
- Database connection or query latency.
- Background job failures.
- Redis cache hit ratio and connection errors.
- Queue lag, retry count, and dead-letter count.
- Route calculation latency and route-cache hit ratio.
- Route invalidation delay after a barrier event.
- SSE connection count and delivery errors.
- Offline synchronization failures and duplicate suppression count.
- EvidenceGuard processing time and privacy-review backlog.
- Uptime.

### Trust and moderation signals

- Open moderation items.
- Average moderation age.
- Conflicting claims.
- Stale claims.
- Rejected or abusive reports.
- Evidence privacy removals.
- Facility claim backlog.
- Facility response time.

### User outcome signals

- Search-to-place-detail completion.
- Use of accessibility filters.
- Accessibility Match Profile creation rate.
- Percentage of matched results with an explanation opened.
- Required-feature unknown rate.
- User-reported confidence in match explanations.
- Report completion rate.
- Successful contribution rate.
- Repeat contributors.
- User-reported confidence before visiting.
- Feedback from disabled users.

Analytics must not infer or expose a disability profile without explicit user consent. Prefer aggregate events such as “filter used” over recording the complete private preference object.

## Incident response

### Severity examples

| Severity | Example | Initial response |
| --- | --- | --- |
| Critical | Private profiles or evidence exposed publicly. | Disable affected access, preserve logs, notify owners, patch, investigate. |
| High | Widespread report loss or incorrect public status. | Stop affected workflow, restore or correct data, communicate impact. |
| Medium | Important feature broken for a subset of users. | Create fix and workaround, monitor recurrence. |
| Low | Cosmetic or non-blocking issue. | Add to planned backlog with user impact. |

For every incident record:

- What happened.
- When it started and ended.
- Who was affected.
- What data or behavior was involved.
- Immediate containment.
- Permanent fix.
- Test added to prevent recurrence.

## Metrics and launch targets

### Coverage

- Number of priority places listed.
- Percentage of priority places with at least one accessibility observation.
- Percentage with recent observations.
- Number of features assessed per place.

### Trust quality

- Percentage of claims with a visible source and date.
- Percentage of claims corroborated.
- Percentage of claims in conflict.
- Stale-data volume.
- Moderator correction rate.
- Facility response rate.

### User success

- Search completion rate.
- Place-page completion rate.
- Report completion rate.
- Filter-to-result interaction rate.
- Number of users who report feeling more prepared to visit.

### Accessibility quality

- Keyboard task completion.
- Screen-reader task completion.
- Number of critical accessibility defects.
- Form error recovery rate.
- User feedback from disabled participants.

### Platform quality

- Search p95 under the pilot target.
- Route p95 under the pilot target.
- Report persistence success rate.
- Live incident propagation delay.
- Offline synchronization success rate.
- Redis cache hit ratio.
- Queue lag and dead-letter rate.
- Evidence privacy-processing success rate.
- Webhook delivery success rate.

Do not use raw user count as the only success measure. A smaller directory with recent and trustworthy information is more valuable than a large directory full of stale or generic claims.

## Major risks and mitigations

### Inaccurate or malicious observations

Use structured forms, observation dates, independent confirmation, rate limits, moderation, evidence handling, and transparent conflict labels.

### Users interpret missing data as a negative result

Make “not assessed” visually and textually distinct from “unavailable”. Add explanatory help at the first point of use.

### Facility managers suppress criticism

Separate facility responses from community observations, preserve history, and audit all privileged actions.

### Sensitive images expose people

Use upload warnings, metadata stripping, moderation, image derivatives, and a simple user request to hide or remove evidence.

### Low initial coverage

Seed priority facilities, partner with disability organizations, organize community mapping, and make missing coverage visible without presenting it as failure.

### Taxonomy becomes too complex

Launch with a small high-value feature set, use progressive disclosure, and add features based on observed user decisions rather than theoretical completeness.

### Contributors lose motivation

Show the impact of useful observations, provide contribution history, acknowledge contributors without exposing sensitive identity, and send meaningful status updates.

### Map provider or geocoder limits

Keep provider access behind interfaces, cache only within terms, use list mode as the core fallback, and document usage limits before pilot launch.

### Redis becomes a hidden source of truth

Keep all user-facing durable records in PostgreSQL, use cache invalidation rather than manual cache editing, and test Redis loss regularly. Queue messages must be rebuildable or retryable.

### Route recommendations create false certainty

Show route constraints, source dates, unknown segments, active incidents, and calculation time. Use “recommended based on available information” rather than “guaranteed accessible”.

### Offline synchronization creates duplicates

Use client-generated idempotency keys, append-only observations, server-confirmed states, and integration tests that retry the same payload multiple times.

### Async workers hide failed updates

Expose queue lag, retry counts, dead-letter jobs, and operator alerts. Give users a pending state rather than claiming that every downstream update is already complete.

### Automated evidence processing makes a wrong accessibility claim

Use automation for privacy and suggestions, not final accessibility decisions. Require contributor or moderator confirmation and preserve the original observation.

### Real-time updates overwhelm users or assistive technology

Send only relevant public events, debounce repeated changes, announce updates accessibly, and let users review or dismiss route recalculation suggestions.

## Post-MVP roadmap

### Next release candidates

- Saved places.
- Email and in-app notifications.
- Multi-language support.
- Better facility onboarding.
- Public data export.
- Local authority review dashboard.
- Accessibility audit events.
- More transport and weather integrations.
- Route alternatives with rest-point and sensory preferences.
- Facility service-level and repair analytics.

### Later capabilities

- Native Android and iOS applications.
- Voice search and read-aloud summaries.
- Sign-language video information.
- Community mapping campaigns.
- Predictive barrier risk based on historical incidents, always shown as a suggestion rather than a fact.
- Multi-city and cross-authority data federation.

Each new capability should preserve the core rules: user-specific needs, feature-level claims, dated observations, visible uncertainty, independent community history, and an accessible non-map interface.

## Final implementation definition

The first production-ready release is complete when:

- The public search and place-detail flow works end to end.
- The list view works without the map.
- Personal preferences are optional and private.
- Users can create an Accessibility Match Profile with required, preferred, and avoid requirements.
- Match results show confirmed requirements, known barriers, unknowns, and the evidence behind each result.
- Unknown required information never appears as a confirmed match.
- Reports persist and can be read back.
- Evidence is protected until approved.
- Claims are derived from observations and show dates and status.
- Confirmations, disputes, stale data, and conflicts are represented.
- Moderators can resolve reports with audit history.
- Facility managers can publish separate official responses.
- A user can request and understand a barrier-aware route.
- Active incidents can invalidate affected route and place data.
- Offline reports synchronize exactly once after reconnecting.
- Redis is used for cache, queue, rate limit, idempotency, and live-update coordination without becoming the source of truth.
- Workers process evidence, claims, routes, notifications, and webhooks with retry and dead-letter behavior.
- EvidenceGuard protects public media derivatives before publication.
- The public API exposes approved incidents and changes without private data.
- Automated and manual accessibility checks have been performed.
- Authorization, privacy, backup, monitoring, and incident processes are documented.
- A pilot group has tested the product with real accessibility decisions.
