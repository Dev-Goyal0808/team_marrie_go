# AccessMap

## Community-verified accessibility information for public spaces

AccessMap is a proposed mobile-first, accessible web application that helps people understand whether public buildings, toilets, footpaths, transport stops, and community facilities meet their individual access needs.

The project responds to **PS 03 — Making Public Spaces More Accessible** under **Accessibility & Inclusion**.

> Accessibility is not binary. A place may work well for one person and still be inaccessible for another. AccessMap therefore reports specific features, observations, barriers, evidence, dates, and confidence instead of assigning every place one simplistic “accessible” label.

## The problem

People with disabilities often cannot reliably determine whether a public place will meet their needs before they visit. Existing map and directory services may show a generic accessibility icon, but they rarely answer practical questions such as:

- Is the entrance genuinely step-free?
- Is the ramp usable, or is it too steep or obstructed?
- Is the lift working today?
- Is there an accessible toilet on the same floor?
- Is the footpath wide and unobstructed?
- Does the transport stop support step-free boarding?
- When was the information last checked?
- Was the information supplied by the facility or observed by a visitor?

This uncertainty can lead to wasted journeys, unsafe situations, physical exhaustion, loss of independence, and exclusion from work, education, healthcare, culture, and community life.

## The solution

AccessMap is more than a directory. It is an **accessibility intelligence platform** in which every accessibility observation can update the directory, route recommendations, live alerts, trust signals, facility workflows, and public data feeds.

The platform combines:

1. **Accessibility Match Profile** — users can mark features as required, preferred, or to avoid, then see how each place matches their own needs without exposing a disability diagnosis or using a misleading universal score.
2. **Feature-level information** — each place is described through concrete features such as step-free entrances, door width, working lifts, toilets, tactile paving, quiet areas, and audio announcements.
3. **Barrier-aware journeys** — users can request routes that avoid stairs, steep slopes, blocked paths, inaccessible transport stops, or other constraints.
4. **Live accessibility incidents** — broken lifts, blocked ramps, construction, flooding, and temporary closures can be published and propagated to affected place and route views.
5. **Offline-first community reporting** — contributors can collect observations in poor-connectivity environments and synchronize them safely later.
6. **Transparent trust signals** — every claim shows whether it is reported, recently observed, corroborated, facility-confirmed, stale, temporarily unavailable, or disputed.
7. **Facility operations and civic APIs** — facility operators and local authorities can respond to barriers, publish updates, and consume verified accessibility change feeds.

The product does not silently convert missing data into a negative result and does not allow a facility’s response to erase independent community observations.

### The platform loop

```text
Community observation
        ↓
Validation and evidence processing
        ↓
Trust and claim recalculation
        ↓
Directory and route updates
        ↓
Live alerts and facility notifications
        ↓
Barrier resolution and new observations
```

This event-driven loop is what allows AccessMap to grow from a searchable directory into a system that helps communities discover and resolve accessibility barriers.

## Core users

- People with disabilities and chronic health conditions
- People with temporary injuries or limited mobility
- Older adults and caregivers
- Community members who observe accessibility conditions
- Facility managers and public-service operators
- Moderators, disability organizations, and local authorities

## MVP capabilities

The first release is intended to provide a complete, useful flow rather than a collection of isolated screens.

### Public directory

- Search by place name, category, or location
- Browse nearby facilities
- View results in both map and accessible list form
- Filter by specific accessibility features
- Sort by distance or freshness
- Open a detailed facility page

### Accessibility Match Profile

- Select optional private requirements such as step-free entry, an accessible toilet, or a working lift
- Classify each need as **required**, **preferred**, or **avoid**
- Keep preferences private by default
- Change or delete preferences at any time
- See confirmed matches, known barriers, and unknown information separately
- See summaries such as “3 of 4 required features confirmed; 1 feature unknown”
- Understand why a place appears as a strong match, partial match, or needs more information

### Facility details

- Address, category, contact details, and opening hours
- Feature-by-feature access information
- Known barriers and temporary problems
- Observation dates and evidence
- Community confirmations and disputes
- Facility responses where available

### Community reporting

- Report an accessibility feature
- Report a new or temporary barrier
- Report incorrect or outdated information
- Add an observation date and structured details
- Upload optional evidence with privacy guidance
- Track the status of submitted reports

### Trust and moderation

- Confirm, dispute, or mark observations as outdated
- Show claim-level confidence rather than one overall facility score
- Flag conflicts for review
- Give moderators a queue for reports, images, duplicates, and abuse
- Keep an audit trail of important status changes

### Barrier-aware journeys

- Request routes using constraints such as no stairs, maximum slope, minimum path width, or active-barrier avoidance
- Explain route distance, time, uncertain segments, and current incidents
- Recalculate when a relevant barrier changes
- Provide the same route explanation in an accessible list format

### Live and offline operations

- Publish time-bounded accessibility incidents
- Stream relevant public updates without requiring a page refresh
- Save reports locally when connectivity is unavailable
- Synchronize offline reports exactly once after reconnection
- Process evidence asynchronously before public display

### Technical showcase capabilities

The platform is designed to demonstrate serious web-system engineering without sacrificing the user outcome:

- Redis/Valkey for cache-aside reads, distributed rate limits, idempotency keys, locks, live incident indexes, and worker queues.
- PostgreSQL/PostGIS as the durable source of truth for places, observations, claims, paths, and incidents.
- Transactional outbox events so a committed report reliably triggers downstream processing.
- Background workers for evidence privacy processing, claim recomputation, route invalidation, notifications, and imports.
- Server-Sent Events for live place and route updates.
- IndexedDB and Background Sync for offline reporting.
- Barrier-aware geospatial routing with route explanations instead of shortest-path-only directions.
- OpenTelemetry traces and queue/cache metrics for production observability.

## Important product principles

### 1. No binary accessibility label

The system reports individual features. For example, a place can have a step-free entrance but no accessible toilet, or an accessible toilet that is temporarily unavailable.

### 2. Unknown is different from unavailable

The interface must distinguish between:

- The feature is confirmed available
- The feature is confirmed unavailable
- The feature is temporarily unavailable
- The feature has not been assessed

### 3. Information must have a date

Access conditions change. Every observation should include when it was observed, and the interface should show whether information is recent, stale, or in need of re-verification.

### 4. Community and facility information coexist

Facility managers can provide official responses, but their responses must remain distinguishable from independent community observations. Neither source should silently overwrite the other.

### 5. The application must be accessible

The product should target WCAG 2.2 AA and provide a complete non-map experience. Search, filtering, reporting, and reading results must work with keyboard navigation and assistive technologies.

### 6. Personal needs remain private

An access profile is optional. The product should not require a diagnosis or expose a person’s disability information in order to provide useful results.

## Verification vocabulary

AccessMap should use precise labels instead of an unexplained score:

| Status | Meaning |
| --- | --- |
| Not assessed | No useful observation is available yet. |
| Community reported | At least one valid community observation exists. |
| Recently observed | The feature was observed within the configured freshness period. |
| Community corroborated | Multiple independent observations agree. |
| Facility confirmed | A verified facility representative confirmed the claim. |
| Temporarily unavailable | The feature exists but is currently unusable. |
| Conflicting information | Recent observations disagree. |
| Needs re-verification | The information is old or has been challenged. |
| Resolved | A previously reported barrier has a newer observation showing a change. |

## Proposed technical direction

This repository is currently a greenfield planning workspace. The recommended implementation is:

- **Frontend:** Next.js, React, and TypeScript
- **UI:** semantic HTML with an accessible component system
- **Backend:** Next.js API/BFF with Supabase Auth, PostgreSQL, PostGIS, and row-level security
- **Cache and workers:** Managed Redis/Valkey with BullMQ or Redis Streams, plus separate TypeScript worker processes
- **Maps:** MapLibre GL JS with OpenStreetMap-compatible data and a compliant tile provider
- **Routing:** Valhalla, GraphHopper, or OSRM behind a routing adapter, enriched by AccessMap barrier data
- **Evidence:** S3-compatible storage with asynchronous privacy scanning and derivative generation
- **Validation:** shared TypeScript schemas for forms and API payloads
- **Testing:** unit, integration, end-to-end, and accessibility testing
- **Deployment:** Dockerized web, worker, and scheduler services with preview, staging, and production environments
- **Monitoring:** OpenTelemetry, error tracking, queue/cache metrics, uptime monitoring, database logs, and privacy-conscious analytics

This is a starting recommendation, not a requirement to lock the project to one vendor. The architectural boundaries in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) allow the data, API, and frontend layers to be replaced independently.

## Documentation map

| Document | Purpose |
| --- | --- |
| [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) | Product requirements, personas, user journeys, feature taxonomy, and acceptance criteria. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, database model, API boundaries, trust pipeline, privacy, and deployment architecture. |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phased build sequence, backlog, testing, CI/CD, pilot launch, metrics, and operational risks. |

## Suggested first demonstration

The strongest demonstration is a wheelchair user planning a journey to a community center:

1. The user creates an Accessibility Match Profile with step-free entrance, accessible toilet, working lift, and wide doors as required, and a quiet area as preferred.
2. AccessMap compares nearby facilities against the profile and shows “3 of 4 required features confirmed” or an equivalent evidence-based explanation.
3. The user sees that an unknown required feature is not treated as a match and that another place has a recently reported obstruction.
4. The user requests a route with no stairs and a maximum slope rather than only the shortest route.
5. A live incident arrives while the user is viewing the route, causing the affected route to be invalidated and recalculated.
6. The user reaches another facility with poor connectivity and submits a blocked-ramp report offline.
7. When connectivity returns, the report synchronizes once using an idempotency key.
8. EvidenceGuard removes photo metadata and flags a possible face for moderation.
9. The claim engine updates the facility and nearby route segments.
10. A facility manager scans a QR code, confirms the ramp was cleared, and publishes a response.
11. The public sees the original report, confirmations, resolution timeline, and current confidence.

## Definition of success for the first release

The MVP is successful when a person can:

1. Search for a nearby facility.
2. Create or use an Accessibility Match Profile with required and preferred features.
3. Read specific, dated information about a place.
4. Understand which profile requirements are confirmed, blocked, stale, or unknown.
5. Submit a structured observation.
6. See the observation move through moderation and verification.
7. Receive a live barrier update without manually refreshing the page.
8. Submit an observation offline and synchronize it later.
9. View a route that explains accessibility constraints and uncertainty.
10. Complete the flow using keyboard navigation and a screen reader.

## Current repository status

The repository initially contained no application code. The current deliverable is the implementation documentation needed to start the project safely and consistently. The next engineering step is to initialize the application skeleton, database migrations, accessibility taxonomy, explainable match engine, and first vertical slice described in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## License and contribution policy

Choose a license and contribution policy before public launch. The moderation and privacy policies should be written alongside the first production implementation because community accessibility data can include sensitive contextual information.
