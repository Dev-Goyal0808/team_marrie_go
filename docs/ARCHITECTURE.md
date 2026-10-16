# AccessMap Technical Architecture

## Document purpose

This document defines the technical shape of AccessMap: the application layers, data model, API boundaries, geospatial behavior, verification pipeline, privacy controls, deployment environments, and operational responsibilities.

The repository is a greenfield workspace, so this architecture is a practical starting point rather than a description of existing code. It favors a small number of well-defined boundaries and a complete first vertical slice over early microservices.

## Architectural goals

The system should be:

- Accessible by default, including when the user does not use a map.
- Transparent about data source, confidence, observation date, and uncertainty.
- Safe for personal access preferences and uploaded evidence.
- Able to support geospatial search without making map interaction mandatory.
- Flexible enough to add new accessibility features without rewriting the application.
- Simple enough for a small team to operate.
- Testable from the public search flow through the database and moderation pipeline.
- Portable enough that the frontend, database, map provider, or storage provider can change independently.

## Recommended technology choices

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Web application | Next.js, React, TypeScript | Server-rendered public pages, strong ecosystem, typed client/server boundary. |
| Styling and UI | Semantic HTML plus an accessible component system | Native controls and predictable keyboard/screen-reader behavior. |
| API boundary | Next.js route handlers or a small typed API module | Keeps the MVP deployable as one application while preserving a clear API. |
| Database | PostgreSQL | Relational integrity for places, claims, reports, users, and audits. |
| Geospatial extension | PostGIS | Radius searches, map bounding boxes, and duplicate proximity checks. |
| Authentication | Supabase Auth or an equivalent managed provider | Email/OTP and social login without implementing credential security from scratch. |
| Cache and event infrastructure | Managed Redis/Valkey | Cache-aside reads, rate limits, idempotency, locks, live incident indexes, and worker queues. |
| Worker runtime | Node.js/TypeScript worker processes | Evidence processing, claim recomputation, route invalidation, notifications, and imports. |
| File storage | Supabase Storage or S3-compatible object storage | Separate evidence files from relational records and support lifecycle rules. |
| Map | MapLibre GL JS with a compliant tile provider | Map rendering without making the product dependent on one proprietary map UI. |
| Routing | Valhalla, GraphHopper, or OSRM behind an adapter | Base route calculation enriched with AccessMap accessibility constraints. |
| Validation | Shared TypeScript schemas | Reuse field rules across forms, API handlers, and tests. |
| Testing | Vitest, Testing Library, Playwright, axe | Covers logic, component behavior, real user flows, and accessibility regressions. |
| Observability | OpenTelemetry, Sentry, metrics, and uptime monitoring | Trace requests through the web app, Redis, workers, database, and integrations. |

The specific managed providers can change. Application code should depend on interfaces for authentication, geocoding, map tiles, object storage, and notifications wherever practical.

## Logical system overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              User devices                               │
│ Mobile browser · PWA · Keyboard · Screen reader · Offline storage       │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTPS / SSE
┌───────────────────────────────▼────────────────────────────────────────┐
│                         Web application / PWA                           │
│ Search · List · Map · Routes · Place detail · Report · Admin UI         │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ typed API calls
┌───────────────────────────────▼────────────────────────────────────────┐
│                         Application API / BFF                           │
│ Places · Routes · Incidents · Observations · Verification · Webhooks     │
└──────────────┬────────────────┬────────────────────┬────────────────────┘
               │                │                    │
               ▼                ▼                    ▼
┌────────────────────┐ ┌─────────────────────┐ ┌────────────────────────┐
│ PostgreSQL +        │ │ Redis / Valkey      │ │ Object storage         │
│ PostGIS             │ │ Cache · Streams     │ │ Evidence originals     │
│ Durable source      │ │ Queues · Locks      │ │ Public derivatives     │
│ of truth            │ │ Rate limits · Live  │ │                        │
│                     │ │ incident indexes    │ │                        │
└──────────┬─────────┘ └──────────┬──────────┘ └────────────────────────┘
           │ transactional         │ events/jobs
           │ outbox                │
           └──────────────┬────────┘
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Worker processes                                │
│ Claim engine · EvidenceGuard · Route invalidation · Sync · Notifications │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ External integrations                                                     │
│ Geocoding · routing engine · transit · weather · email · AI assistance   │
└────────────────────────────────────────────────────────────────────────┘
```

## Application boundaries

### Public web application

Responsibilities:

- Render searchable public place pages.
- Provide map and list views.
- Run accessible forms and validation feedback.
- Display claim-level status, source, and freshness.
- Request location permission only when needed.
- Keep the essential flow usable when JavaScript or map assets are unavailable where practical.

The public application should not query the database directly from arbitrary browser code. Public data access should go through controlled server functions or API routes so that filtering, caching, rate limiting, and privacy rules are consistent.

### Authenticated application area

Responsibilities:

- Manage the user's private access preferences.
- Submit observations and evidence.
- Show the user's contribution history.
- Allow correction or deletion requests.

### Facility area

Responsibilities:

- Submit a place claim.
- Show the facility representative the public information and community history.
- Publish an official response or temporary status update.
- Keep facility actions visibly distinct from independent observations.

### Moderator area

Responsibilities:

- Review reports, evidence, duplicates, conflicts, and abuse flags.
- Resolve or escalate moderation items.
- Manage facility claims.
- Preserve an audit trail.

### Background jobs

Responsibilities:

- Detect stale observations.
- Recalculate claim summaries when observations change.
- Process transactional outbox events.
- Process uploaded evidence through privacy and media checks.
- Invalidate affected route results when barriers change.
- Synchronize offline reports safely.
- Send re-verification prompts.
- Generate notifications.
- Run image-processing and retention tasks.
- Produce operational reports.

Run these jobs in separate worker processes using Redis/Valkey-backed queues or streams. The web application must remain responsive if a worker is delayed, and every job must be retryable and idempotent.

### Event and worker boundaries

The API writes durable business data and an outbox event in one PostgreSQL transaction. A publisher then delivers the event to Redis Streams. Workers consume events using consumer groups and acknowledge them only after the side effect succeeds.

```text
API transaction
  ├── observation row
  ├── moderation row
  └── outbox event
          ↓
Outbox publisher
          ↓
Redis Stream
          ↓
Worker consumer group
  ├── claim recomputation
  ├── cache invalidation
  ├── route invalidation
  ├── evidence processing
  └── notification/webhook delivery
```

PostgreSQL is the source of truth. Redis loss can delay processing or reduce performance, but it must not delete a committed observation.

## Suggested repository structure

```text
accessmap/
├── apps/
│   └── web/
│       ├── app/                  # Routes and server-rendered pages
│       ├── components/           # Shared visual and form components
│       ├── features/
│       │   ├── places/            # Search, listing, place details
│       │   ├── accessibility/     # Taxonomy, preferences, status display
│       │   ├── observations/      # Reports, confirmations, disputes
│       │   ├── moderation/        # Queue and review tools
│       │   ├── facilities/        # Manager workflows
│       │   └── profiles/          # User settings and contributions
│       ├── lib/                  # Server clients and utilities
│       └── tests/                # App-level tests
├── packages/
│   ├── types/                    # Shared domain types
│   ├── validation/               # Shared schemas and error messages
│   ├── ui/                       # Reusable accessible components
│   ├── config/                   # Lint, TypeScript, and test config
│   └── events/                   # Event envelope and event-name contracts
├── workers/
│   ├── runner/                   # Worker bootstrap and queue consumers
│   ├── claim-engine/             # Claim/trust recomputation
│   ├── evidence-guard/           # Media safety and derivative processing
│   ├── route-invalidation/       # Barrier-to-route cache invalidation
│   └── notifications/            # Email, in-app, and webhook delivery
├── supabase/
│   ├── migrations/               # Ordered schema changes
│   ├── seed/                     # Development and pilot data
│   └── functions/                # Scheduled or privileged operations
├── infra/
│   ├── docker-compose.yml         # Local Postgres, Redis, MinIO, and Mailpit
│   ├── observability/             # OpenTelemetry and local metrics config
│   └── deployment/                # Container and environment definitions
├── docs/
│   ├── PRODUCT_PLAN.md
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
├── .github/workflows/            # CI and deployment checks
├── package.json
└── README.md
```

## Domain vocabulary

The codebase should use consistent terms:

- **Place:** A public facility or location listed in the directory.
- **Feature:** A type of accessibility information, such as `step_free_entrance`.
- **Observation:** A contributor's structured report about one feature at one place.
- **Claim:** The current aggregated interpretation of observations for one place-feature pair.
- **Verification event:** A confirmation, dispute, or outdated signal applied to an observation or claim.
- **Facility response:** A statement from a verified representative of the place.
- **Evidence:** Optional media or structured measurement supporting an observation.
- **Freshness:** How recently an applicable feature was observed.
- **Moderation item:** A report or entity requiring review.

Keeping these concepts separate prevents a facility, a report, and an aggregated claim from being represented by one ambiguous database record.

## Event contract

All asynchronous events should use a shared envelope:

```json
{
  "eventId": "evt_123",
  "eventType": "observation.submitted",
  "aggregateType": "observation",
  "aggregateId": "obs_456",
  "version": 1,
  "occurredAt": "2026-10-16T12:00:00Z",
  "actorId": "user_789",
  "traceId": "trace_abc",
  "payload": {
    "placeId": "place_123",
    "featureCode": "step_free_entrance",
    "value": "temporarily_unavailable"
  }
}
```

Core event names include:

```text
place.created
observation.submitted
observation.approved
observation.rejected
observation.confirmed
observation.disputed
barrier.created
barrier.resolved
claim.recomputed
facility.response.published
route.invalidated
evidence.processed
notification.requested
```

Event payloads must be versioned, redacted, and safe to retry. They should not include private access-profile values, raw evidence, authentication tokens, or unnecessary personal information.

## Data model

### Design rules

1. Store raw observations separately from derived claim summaries.
2. Preserve historical observations instead of overwriting them.
3. Store access preferences separately from public contribution data.
4. Use enumerated values or lookup tables for feature codes and statuses.
5. Store timestamps in UTC and render them in the user's locale.
6. Store coordinates as a PostGIS geometry with a consistent SRID.
7. Keep moderation and audit records append-oriented.
8. Use soft deletion or visibility states for public content that must be hidden while preserving history.

### `users`

Authentication identity and account status.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key, linked to the auth provider. |
| `email` | Text | Private; never exposed in public responses. |
| `display_name` | Text | Optional public display name. |
| `role` | Enum | `user`, `moderator`, `admin`, `facility_manager`. |
| `status` | Enum | `active`, `suspended`, `deleted`. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

### `user_access_profiles`

Private personalization preferences. This table must not be publicly readable.

| Field | Type | Notes |
| --- | --- | --- |
| `user_id` | UUID | Primary key and foreign key to `users`. |
| `mobility_needs` | JSONB | Selected mobility-related feature codes. |
| `visual_needs` | JSONB | Selected visual access feature codes. |
| `hearing_needs` | JSONB | Selected hearing and communication codes. |
| `sensory_needs` | JSONB | Selected sensory environment codes. |
| `cognitive_needs` | JSONB | Selected clarity and predictability codes. |
| `toilet_needs` | JSONB | Selected toilet and personal-care codes. |
| `transport_needs` | JSONB | Selected transport and outdoor codes. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

The first implementation may use JSONB for grouped preferences because the taxonomy will evolve. If analytics require relational joins later, preferences can be normalized into a join table without changing the public API.

### `places`

Public facilities and locations.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `name` | Text | Public name. |
| `category_id` | UUID | Foreign key to `place_categories`. |
| `description` | Text | Optional public description. |
| `address` | Text | Normalized display address. |
| `city` | Text | Searchable administrative area. |
| `postal_code` | Text | Optional. |
| `latitude` | Decimal | Display and integration value. |
| `longitude` | Decimal | Display and integration value. |
| `geom` | Geography(Point) | PostGIS search value. |
| `phone` | Text | Optional public contact. |
| `website` | Text | Optional validated URL. |
| `opening_hours` | JSONB | Structured hours where known. |
| `source` | Enum | `admin`, `community`, `import`, `facility`. |
| `status` | Enum | `active`, `pending_review`, `temporarily_closed`, `permanently_closed`, `duplicate`. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

### `place_categories`

Examples include government office, healthcare, education, library, transport stop, park, restaurant, retail, religious building, sports facility, cultural venue, community center, and public toilet.

### `accessibility_features`

The configurable taxonomy.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `code` | Text | Stable machine-readable code. |
| `category` | Enum | Entrance, toilet, transport, sensory, and so on. |
| `label` | Text | Plain-language display label. |
| `description` | Text | Help text and reporting guidance. |
| `input_type` | Enum | Boolean, enum, measurement, text, or multi-select. |
| `freshness_days` | Integer | Re-check period. |
| `active` | Boolean | Allows taxonomy changes without deleting history. |

Feature codes should be stable identifiers. Labels and descriptions can be translated later without changing stored observations.

### `observations`

The immutable or mostly append-oriented record of a contributor's experience.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Foreign key to `places`. |
| `feature_id` | UUID | Foreign key to `accessibility_features`. |
| `contributor_id` | UUID | Foreign key to `users`; can be an approved anonymous contributor identity later. |
| `value` | Enum | `yes`, `no`, `partial`, `temporarily_unavailable`, `unknown`. |
| `details` | Text | Public description after moderation. |
| `measured_value` | JSONB | Optional measurement and unit. |
| `observed_at` | Date/Time | When the person observed the condition. |
| `submitted_at` | Timestamp | When it entered the system. |
| `visibility` | Enum | `public`, `limited`, `hidden`, `deleted`. |
| `moderation_status` | Enum | `pending`, `approved`, `rejected`, `changes_requested`. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

An observation should not be edited in a way that destroys its original meaning. A meaningful correction should create a new version or an amendment record.

### `claims`

Derived or moderated summary for a place-feature pair.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Foreign key. |
| `feature_id` | UUID | Foreign key. |
| `status` | Enum | Product status such as `not_assessed`, `community_reported`, or `conflicting`. |
| `summary_value` | Enum | Aggregated positive, negative, partial, temporary, or unknown value. |
| `latest_observed_at` | Timestamp | Most recent valid observation. |
| `freshness_state` | Enum | `fresh`, `stale`, `needs_reverification`. |
| `supporting_count` | Integer | Number of eligible supporting observations. |
| `disputing_count` | Integer | Number of eligible disputes or contrary observations. |
| `calculation_version` | Integer | Allows trust rules to evolve safely. |
| `updated_at` | Timestamp | UTC. |

Claims are derived data. The system should be able to rebuild them from observations and verification events.

### `verification_events`

Records a confirmation, dispute, outdated signal, or other verification action.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `observation_id` | UUID | Target observation. |
| `user_id` | UUID | Verifier. |
| `event_type` | Enum | `confirmed`, `disputed`, `outdated`, `helpful`. |
| `comment` | Text | Optional public or moderated explanation. |
| `created_at` | Timestamp | UTC. |

The system should prevent duplicate or self-confirming events where they would undermine independence.

### `access_nodes`

Represents a meaningful point in a place or journey graph, such as an entrance, lift, accessible toilet, transport stop, curb crossing, or destination room.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Owning place where applicable. |
| `node_type` | Enum | Entrance, lift, toilet, stop, crossing, room, or connector. |
| `label` | Text | Plain-language display label. |
| `floor` | Text | Optional indoor floor or level. |
| `geom` | Geography(Point) | Location of the access node. |
| `status` | Enum | Active, closed, pending review. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

### `access_edges`

Represents movement between two nodes. Edges allow route planning to reason about a facility and its surrounding paths instead of treating a place as one point.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `from_node_id` | UUID | Start node. |
| `to_node_id` | UUID | End node. |
| `geometry` | Geography(LineString) | Traversable path geometry. |
| `surface_type` | Text | Paved, gravel, uneven, and so on. |
| `width_meters` | Decimal | Optional measured width. |
| `slope_percent` | Decimal | Optional measured slope. |
| `stairs` | Boolean | Whether stairs are present. |
| `step_free` | Boolean | Whether step-free movement is known. |
| `last_observed_at` | Timestamp | Most recent edge observation. |
| `status` | Enum | Active, blocked, closed, unknown. |

### `barrier_events`

Represents a temporary or persistent barrier associated with a place, node, feature, or route edge.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Optional owning place. |
| `access_node_id` | UUID | Optional affected node. |
| `access_edge_id` | UUID | Optional affected path segment. |
| `feature_id` | UUID | Optional feature code. |
| `reported_by` | UUID | Contributor, facility, authority, or system actor. |
| `severity` | Enum | Informational, warning, major, critical. |
| `status` | Enum | Reported, validated, published, disputed, resolved, archived. |
| `starts_at` | Timestamp | UTC. |
| `review_at` | Timestamp | When the incident should be rechecked. |
| `resolved_at` | Timestamp | UTC when resolved. |
| `created_at` | Timestamp | UTC. |

An active incident does not replace the permanent feature record. A lift can remain a facility feature while also having an active broken-lift incident.

### `route_profiles`

Stores reusable, non-medical route constraints. Profiles are private unless the user explicitly shares one.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | Owner. |
| `name` | Text | User-chosen label such as “wheelchair route”. |
| `constraints` | JSONB | Stairs, slope, width, curb, surface, and other constraints. |
| `private` | Boolean | Defaults to true. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

Example constraints:

```json
{
  "avoidStairs": true,
  "maxSlopePercent": 6,
  "minimumWidthMeters": 1.2,
  "requireCurbRamps": true,
  "avoidUnknownSegments": false
}
```

### `outbox_events`

Durable events written in the same transaction as the business record that produced them.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Event ID and idempotency identity. |
| `event_type` | Text | Stable event name. |
| `aggregate_type` | Text | Observation, place, claim, incident, and so on. |
| `aggregate_id` | UUID | Target aggregate. |
| `payload` | JSONB | Redacted event data. |
| `published_at` | Timestamp | Null until delivered. |
| `attempt_count` | Integer | Publisher attempts. |
| `last_error` | Text | Redacted failure information. |
| `created_at` | Timestamp | UTC. |

### `webhook_subscriptions`

Allows approved civic or facility integrations to subscribe to selected public events.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `owner_id` | UUID | API consumer or facility. |
| `endpoint` | Text | HTTPS endpoint. |
| `events` | JSONB | Allowed event types. |
| `secret_hash` | Text | Secret material is never stored in plaintext. |
| `status` | Enum | Active, paused, revoked. |
| `last_delivery_at` | Timestamp | UTC. |
| `failure_count` | Integer | Delivery failure count. |

### `evidence_assets`

Optional media or files connected to an observation.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `observation_id` | UUID | Foreign key. |
| `storage_key` | Text | Private object-storage path. |
| `public_key` | Text | Sanitized public derivative if approved. |
| `media_type` | Enum | Image or supported document type. |
| `moderation_status` | Enum | `pending`, `approved`, `rejected`, `redacted`. |
| `alt_text` | Text | Required before public display. |
| `created_at` | Timestamp | UTC. |

Evidence should be optional. A person must be able to report a barrier without taking a photo.

### `facility_claims`

Connects a facility representative to a place.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Claimed place. |
| `user_id` | UUID | Requesting representative. |
| `organization_name` | Text | Claimed organization. |
| `verification_method` | Enum | Official email, phone callback, document review, admin invitation. |
| `status` | Enum | `pending`, `approved`, `rejected`, `revoked`. |
| `reviewed_by` | UUID | Moderator or admin. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

### `facility_responses`

Official statements linked to a place and optionally a feature.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `place_id` | UUID | Target place. |
| `feature_id` | UUID | Optional feature being addressed. |
| `manager_id` | UUID | Approved facility representative. |
| `response` | Text | Public response. |
| `status_value` | Enum | Optional official feature status. |
| `evidence` | JSONB | Structured official details. |
| `created_at` | Timestamp | UTC. |
| `updated_at` | Timestamp | UTC. |

### `moderation_items`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `entity_type` | Enum | Observation, evidence, place, claim, facility claim, user. |
| `entity_id` | UUID | Target entity. |
| `reason` | Enum | Spam, privacy, abuse, duplicate, conflict, sensitive image, other. |
| `priority` | Enum | Low, normal, high, urgent. |
| `status` | Enum | Open, assigned, resolved, escalated. |
| `assigned_to` | UUID | Moderator. |
| `resolution` | Text | Explanation of action. |
| `created_at` | Timestamp | UTC. |
| `resolved_at` | Timestamp | UTC. |

### `audit_logs`

Privileged and material state changes.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `actor_id` | UUID | User or system actor. |
| `action` | Text | Stable action code. |
| `entity_type` | Text | Target type. |
| `entity_id` | UUID | Target identifier. |
| `metadata` | JSONB | Redacted context. |
| `created_at` | Timestamp | UTC. |

Do not put private access-profile values, passwords, tokens, or raw sensitive payloads in audit metadata.

## API boundaries

The API should expose domain operations, not arbitrary database tables. Public responses should return only fields appropriate for the current user and should include a stable schema version when the API becomes external.

### Public endpoints

```text
GET  /api/places
GET  /api/places/:placeId
GET  /api/places/:placeId/claims
GET  /api/places/:placeId/observations
GET  /api/features
GET  /api/categories
GET  /api/search
GET  /api/incidents
GET  /api/places/:placeId/incidents
GET  /api/places/:placeId/access-graph
GET  /api/routes
GET  /api/changes
GET  /api/stream/places/:placeId
```

Example search request:

```text
GET /api/places?
  latitude=12.9716&
  longitude=77.5946&
  radius=5000&
  category=library&
  features=step_free_entrance,accessible_toilet&
  sort=distance&page=1
```

The backend must validate radius, page size, coordinates, category codes, and feature codes. Do not accept arbitrary SQL-like filter expressions.

Route requests should use a bounded, versioned schema:

```text
GET /api/routes?
  origin=lat,lng&
  destination=place_123&
  profile=wheelchair&
  avoid=stairs,active_barriers
```

Route responses must include the route's calculation time, data freshness, constraint summary, affected segments, and uncertainty. A route is a recommendation, not a guarantee.

Server-Sent Events can expose live public changes:

```text
GET /api/stream/places/:placeId
GET /api/stream/map?bbox=...
```

The server should authorize subscriptions, bound the geographic area, and send only public events.

### Authenticated user endpoints

```text
GET    /api/me
GET    /api/me/access-profile
PATCH  /api/me/access-profile
GET    /api/me/observations
POST   /api/observations
PATCH  /api/observations/:observationId
POST   /api/observations/:observationId/evidence
POST   /api/observations/:observationId/verify
POST   /api/observations/:observationId/dispute
POST   /api/places/:placeId/report
POST   /api/observations/sync
GET    /api/me/offline-sync
POST   /api/route-profiles
PATCH  /api/route-profiles/:profileId
```

### Facility endpoints

```text
POST   /api/places/:placeId/claim
GET    /api/facility/places
GET    /api/facility/places/:placeId
POST   /api/facility/responses
PATCH  /api/facility/responses/:responseId
POST   /api/facility/incidents
PATCH  /api/facility/incidents/:incidentId
POST   /api/facility/qr-codes
```

The server must check that a facility claim is approved before allowing a response to be published.

### Moderator endpoints

```text
GET    /api/moderation/queue
GET    /api/moderation/items/:itemId
POST   /api/moderation/items/:itemId/approve
POST   /api/moderation/items/:itemId/reject
POST   /api/moderation/items/:itemId/request-changes
POST   /api/moderation/items/:itemId/escalate
POST   /api/places/:placeId/merge
GET    /api/moderation/incidents/:incidentId
POST   /api/moderation/evidence/:evidenceId/redact
```

All moderator actions should require an authenticated role check, a validated action body, and an audit log entry.

### Civic and integration endpoints

Version public integrations separately from the internal application API:

```text
GET  /api/v1/places/:placeId/accessibility
GET  /api/v1/incidents?bbox=...
GET  /api/v1/changes?since=...
POST /api/v1/webhooks
```

Require API keys or signed credentials for subscriptions, enforce pagination and rate limits, and return only public, approved data.

## Search and geospatial behavior

### Place search

Use PostGIS for:

- Radius search around a point.
- Bounding-box search for map movement.
- Distance sorting.
- Duplicate detection near an existing place.
- Nearby place suggestions when the exact search returns no result.

Example conceptual query:

```sql
SELECT
  id,
  name,
  category_id,
  address,
  ST_Distance(
    geom,
    ST_SetSRID(ST_Point(:longitude, :latitude), 4326)::geography
  ) AS distance_meters
FROM places
WHERE status = 'active'
  AND ST_DWithin(
    geom,
    ST_SetSRID(ST_Point(:longitude, :latitude), 4326)::geography,
    :radius_meters
  )
ORDER BY distance_meters
LIMIT :page_size;
```

The actual implementation should use parameterized queries or a trusted ORM/query builder.

### Map/list contract

The list response must contain all information needed to render an accessible result card without asking the map component for additional data. The map is a visualization of search results, not the source of truth.

### Geocoding

Geocoding should be isolated behind a service interface:

```ts
interface Geocoder {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(latitude: number, longitude: number): Promise<GeocodingResult | null>;
}
```

Cache normalized results where allowed by the provider's terms. Do not store more location history than the user needs.

### Barrier-aware routing

The routing engine should be isolated behind an adapter so the product can change routing providers without changing route profiles or UI contracts.

```ts
interface RoutingEngine {
  calculate(request: RouteRequest): Promise<RouteResult>;
}

interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  constraints: RouteConstraints;
  avoidIncidentIds?: string[];
}
```

The base engine supplies a route over roads and footpaths. AccessMap then enriches the result with:

- Access edge observations.
- Stairs and slope constraints.
- Curb-ramp status.
- Lift and transport availability.
- Active barrier events.
- Unknown or stale segments.

Hard constraints should remove an edge where the user has explicitly required a condition. Soft preferences should add a cost or warning. The result should include the affected segments and explain why a route was chosen.

Route responses can be cached using a normalized hash of origin, destination, constraint profile, and relevant incident version. A new barrier event should invalidate only nearby or affected route keys rather than flushing the entire route cache.

### Live incident indexing

PostGIS remains the source of truth for incident geometry. Redis can maintain short-lived lookup structures for active incidents, recent incident IDs, and tile or viewport subscriptions. A practical cell key is:

```text
accessmap:incident:cell:{h3Cell}
```

When an incident is created or resolved, a worker identifies intersecting cells and route edges, invalidates relevant cache keys, and publishes a public event to subscribed clients.

## Observation and verification pipeline

```text
Place suggestion, QR code, or seeded place
          │
          ▼
Structured observation submitted online or offline
          │
          ▼
Client validation ── invalid ──► field errors, no data loss
          │
          ▼
Server validation, idempotency, and rate limits
          │
          ├── suspicious/sensitive ──► moderation queue
          │
          ▼
PostgreSQL transaction
  ├── observation
  ├── moderation item
  └── outbox event
          │
          ▼
Redis Stream / worker consumers
  ├── EvidenceGuard processing
  ├── claim recomputation
  ├── cache invalidation
  ├── route invalidation
  ├── notifications/webhooks
  └── live SSE event
          │
          ▼
Approved observation becomes public
          │
          ▼
Confirmations, disputes, incidents, and freshness updates
          │
          ▼
Place page and routes show status, source, date, and uncertainty
```

### Stage 1: Place intake

Places may come from an administrator, an approved public-data import, a community suggestion, or a facility manager. Intake should validate required identity and coordinates and attempt duplicate detection using normalized name, address, and geographic proximity.

### Stage 2: Observation validation

Validate:

- Authenticated contributor or approved anonymous workflow.
- Existing active place.
- Active feature code.
- Allowed status for that feature.
- Reasonable observation date.
- Description length and allowed content.
- Measurement format and units.
- File type and size.

### Stage 3: Automated safety checks

Flag, rather than automatically discard where possible:

- Repeated identical reports.
- High-frequency submissions from one account.
- Personal contact details in public text.
- Offensive or threatening language.
- Images containing faces, documents, or other sensitive details.
- Suspicious file signatures.
- Reports that strongly conflict with several recent observations.

### Stage 4: Publication

An ordinary valid report may be visible as:

> Community reported — pending further confirmation.

Sensitive, abusive, or high-risk submissions should wait for moderation. Never imply that an observation is approved before the server has confirmed its state.

### Stage 4A: EvidenceGuard processing

Evidence processing is asynchronous and must not block the durable observation record. A worker should:

1. Validate the file signature.
2. Strip EXIF and unnecessary metadata.
3. Generate a resized derivative.
4. Scan for faces, license plates, documents, and sensitive text.
5. Create alt-text suggestions.
6. Mark the evidence approved, redacted, or awaiting moderation.

The public observation can exist while its image remains private or pending.

### Stage 5: Claim aggregation

The claim aggregator should:

1. Load approved observations for one place-feature pair.
2. Exclude hidden, rejected, or deleted observations.
3. Apply freshness windows.
4. Detect independent contributors.
5. Count supporting and disputing observations.
6. Detect material conflicts.
7. Select the current summary value.
8. Set a status and freshness state.
9. Store the calculation version.
10. Write an audit or system event if a public status materially changes.

The aggregation algorithm should be deterministic and covered by unit tests. It should not be an opaque machine-learning score in the MVP.

### Stage 6: Downstream event effects

When a claim or incident changes, workers can:

- Invalidate the affected place and search caches.
- Invalidate nearby route keys.
- Publish a live SSE event.
- Notify saved-place subscribers.
- Deliver approved facility or civic webhooks.
- Update trust and operational metrics.

### Initial aggregation rules

- One approved observation creates `community_reported`.
- Two independent agreeing observations create `community_corroborated`.
- A verified facility response creates a separate `facility_confirmed` source state.
- A recent temporary-unavailability observation can surface `temporarily_unavailable` even when older observations say the feature exists.
- Materially different recent observations create `conflicting_information`.
- Claims outside their freshness period become `needs_reverification` or stale.
- A resolved barrier requires a newer observation or official update; a facility assertion alone should be visibly labeled.

## Authorization and row-level security

Authorization should be enforced in the database layer as well as in application code.

### Public users

Can read:

- Active places
- Public place metadata
- Approved public claims
- Approved public observations
- Approved facility responses
- Public feature taxonomy

Cannot read:

- Private access profiles
- Contributor email addresses
- Hidden evidence originals
- Moderation notes
- Audit metadata
- Unapproved sensitive reports

### Authenticated contributors

Can:

- Read and update their own private preferences.
- Create observations subject to server validation.
- Read their own submissions, including pending state.
- Request changes or deletion for their own submissions.
- Add one eligible verification event per target according to anti-abuse rules.

Cannot:

- Approve their own moderation item.
- Edit another contributor's observation.
- Claim a facility without verification.
- Read another user's private profile.

### Facility managers

Can:

- Read public information for approved claimed places.
- Draft and publish permitted facility responses.
- Update official contact and operational details within their scope.

Cannot:

- Delete community observations.
- Modify claims outside their approved place.
- Access contributor private information.

### Moderators and administrators

Can review and resolve content within their role, with all material actions logged. Administrator-only actions should include role assignment, deletion of sensitive data, and changes to the taxonomy or trust configuration.

## File and evidence handling

1. Accept only allowed media types.
2. Enforce server-side size limits.
3. Generate a random storage key; never use the original filename as a public identifier.
4. Scan the file signature and content.
5. Strip EXIF metadata and other unnecessary metadata.
6. Generate a resized derivative.
7. Queue the image for privacy moderation.
8. Require alt text or an approved image description before public display.
9. Store original evidence in a restricted bucket with retention rules.
10. Allow a moderator or user with appropriate authority to hide the public derivative.

The app should show a clear warning before upload:

> Do not include people, documents, personal addresses, or other private information in this image.

## Privacy and security architecture

### Data minimization

Do not collect medical diagnoses, unnecessary identity data, or precise personal movement history. A user can search manually without storing their location.

### Private access preferences

The access profile is personal configuration, not a public identity attribute. It must be excluded from public API serializers, analytics events, logs, and error payloads.

### Location handling

- Use browser location only after user permission.
- Use approximate or current search coordinates only for the requested operation where possible.
- Do not store continuous location history.
- Avoid associating a contributor's report with their home location.

### Content safety

- Sanitize rendered user content.
- Escape text in all HTML contexts.
- Use secure HTTP headers.
- Apply CSRF protection where cookie-based mutation requests are used.
- Rate-limit login, report, upload, and verification endpoints.
- Keep secrets only in environment configuration.
- Never log access tokens, passwords, raw private profiles, or unredacted sensitive evidence.

### Account deletion

Account deletion should define what happens to community contributions. A practical default is to remove or anonymize personal attribution while preserving the public observation if it remains valuable and lawful to retain. This decision must be documented in the privacy policy and implemented consistently.

## Redis/Valkey responsibilities

Redis/Valkey is an acceleration and coordination layer, not the durable source of truth.

### Cache-aside reads

Cache hot and derived data:

```text
accessmap:place:{placeId}:summary
accessmap:claims:{placeId}:v{version}
accessmap:search:{normalizedHash}
accessmap:route:{routeHash}
accessmap:incident:cell:{h3Cell}
```

The API reads Redis first, loads PostgreSQL or the routing engine on a miss, and writes a bounded TTL. Claim and incident events explicitly invalidate affected keys.

### Rate limiting

Use a token bucket or sliding window for login, report, verification, uploads, facility claims, public API calls, and webhook delivery:

```text
ratelimit:user:{userId}:reports
ratelimit:ip:{ip}:login
ratelimit:api-key:{keyId}
```

### Idempotency and locks

```text
idempotency:{userId}:{clientRequestId}
lock:claim:{placeId}:{featureId}
lock:route-invalidation:{edgeId}
lock:facility-sync:{facilityId}
```

Idempotency keys prevent duplicate offline submissions. Short-lived locks prevent multiple workers from recomputing the same claim or invalidating the same route set simultaneously.

### Queues and streams

Use Redis Streams with consumer groups or BullMQ for:

- `queue:evidence-processing`
- `queue:claim-recompute`
- `queue:route-invalidation`
- `queue:offline-sync`
- `queue:notifications`
- `queue:webhooks`
- `queue:imports`

Workers acknowledge a message only after the side effect succeeds. Failed messages should retry with backoff and move to a dead-letter or manual-review state after the configured limit.

### Live updates

Redis Streams or Pub/Sub can fan out public incident changes to an SSE layer. The SSE layer should not expose private stream data and should enforce bounded subscriptions by place or geographic area.

### Redis security and failure behavior

- Use TLS and authentication for managed Redis.
- Keep Redis on a private network where available.
- Use ACLs for web, worker, and monitoring roles.
- Do not place private access profiles or raw evidence in Redis.
- Configure memory limits and eviction policies explicitly.
- Treat cache loss as recoverable.
- Treat unacknowledged queue messages as retryable.

## Caching and performance

Cache carefully:

- Public place pages can use short-lived server caching backed by Redis.
- Search results can use bounded cache keys based on normalized parameters.
- Accessibility claims should be invalidated when a new observation or response changes the place-feature summary.
- Route results should include a relevant incident or graph version in their cache key.
- Private profile and moderation responses must not be placed in shared caches.
- Image derivatives should use long-lived immutable URLs.
- A cache miss must never change the semantic result; it should only affect latency.

Suggested first performance targets:

- Public place page first meaningful content in under 2 seconds on a typical mobile connection.
- Search response under 500 ms for common radius queries at pilot scale.
- List view renders usable result text before map tiles finish loading.
- Report submission gives a server-confirmed result within normal network timeout limits.

Measure before optimizing. The map must not delay the text result experience.

## Background jobs

Initial scheduled tasks:

| Job | Frequency | Responsibility |
| --- | --- | --- |
| Outbox publisher | Continuous | Publish committed PostgreSQL events to Redis Streams. |
| Claim recomputation | Event-driven | Rebuild affected place-feature claims. |
| Route invalidation | Event-driven | Invalidate nearby route keys after barrier or graph changes. |
| EvidenceGuard | Event-driven | Scan, redact, resize, and describe evidence. |
| Offline sync processor | Event-driven | Deduplicate and persist offline observations. |
| Claim freshness update | Daily | Mark stale or re-verification states. |
| Re-verification reminders | Daily | Notify contributors or facility managers where configured. |
| Evidence cleanup | Daily | Remove expired private derivatives and failed uploads. |
| Notification/webhook delivery | Event-driven | Send email, in-app, SSE, or API consumer updates. |
| Operational report | Weekly | Summarize conflicts, stale data, queue lag, moderation backlog, and errors. |

Jobs should be idempotent. A retry must not create duplicate claim records, notifications, route invalidations, or audit events. Queue lag and dead-letter counts should be visible to operators.

## Deployment architecture

### Environments

#### Local

- Docker Compose web app.
- Development PostgreSQL/PostGIS or isolated Supabase project.
- Local Redis/Valkey.
- Worker and scheduler processes.
- MinIO or another local S3-compatible service for evidence.
- Mailpit for notification testing.
- Seeded example places and test accounts with non-real data.

#### Preview

- One deployment per pull request where feasible.
- Isolated or resettable database data.
- Isolated Redis namespace or preview Redis instance.
- Safe integration keys.
- Accessibility and end-to-end smoke checks.

#### Staging

- Production-like configuration.
- Separate database and storage buckets.
- Managed Redis/Valkey with queue metrics.
- Separate web and worker deployments.
- Full seed and migration rehearsal.
- Moderator and pilot review.

#### Production

- Restricted secrets.
- Automated backups.
- Migration approval.
- Monitoring and alerts.
- Separate public and private storage policies.
- Stateless web instances that can scale horizontally.
- Independently scalable workers for evidence, claims, routes, and notifications.
- Redis/Valkey TLS, ACLs, memory limits, and failure alerts.

### Container topology

```text
web container       → API, SSR, list/map UI, SSE endpoint
worker container    → Redis consumers and background side effects
scheduler container → freshness and periodic jobs
managed database    → PostgreSQL + PostGIS source of truth
managed Redis       → cache, streams, queues, locks, rate limits
object storage      → evidence originals and public derivatives
```

The first production deployment does not require Kubernetes. Use Docker images and separate managed services on ECS/Fargate, Fly.io, Render, or an equivalent platform. Kubernetes can be considered when worker scaling, isolation, or multi-region operations justify it.

### Release flow

```text
Feature branch
      │
      ▼
Pull request → lint → typecheck → unit tests → E2E → accessibility checks
      │
      ▼
Preview web deployment and worker smoke test
      │
      ▼
Merge to main
      │
      ▼
Staging database migration, Redis check, worker processing, and smoke test
      │
      ▼
Production migration and deployment
      │
      ▼
Post-deploy smoke test, queue check, trace check, and monitoring
```

Database migrations must be forward-compatible where possible. Destructive migrations require a backup, a rollback plan, and explicit review.

## Architecture decisions

### Decision: modular monolith for the MVP

Use one deployable web application with clear feature modules instead of multiple microservices. This reduces operational overhead while preserving boundaries in the code and API.

### Decision: relational source of truth

Use PostgreSQL because places, observations, claims, facility responses, moderation, and audit history have strong relationships and consistency requirements.

### Decision: derived claims, preserved observations

Store the source observations and calculate current claims from them. This allows trust rules to evolve and makes the public result explainable.

### Decision: map as an optional visualization

The accessible list is a first-class interface. Map libraries and tile providers can change without removing directory functionality.

### Decision: feature-level trust instead of facility score

A single score would hide important differences and encourage false certainty. Claim-level statuses align with the user's actual decision.

### Decision: Redis is an acceleration and coordination layer

Redis/Valkey is valuable for distributed cache, rate limiting, idempotency, locks, queues, streams, and live updates. PostgreSQL remains the source of truth so that a cache or queue outage cannot erase a report.

### Decision: transactional outbox for reliable side effects

Business data and the event that describes its change are committed together. This prevents a report from being stored successfully while the downstream claim, route, or notification update is silently lost.

### Decision: worker processes instead of request-time heavy work

Evidence processing, route invalidation, claim calculation, imports, and notifications run asynchronously. The API returns a clear accepted or pending state without blocking on slow external services.

### Decision: route constraints over universal accessibility claims

Routes are calculated against a user's selected constraints and current evidence. The product explains uncertainty and does not promise that one route is suitable for every person.

### Decision: append-only observations for offline safety

Offline synchronization is safer when observations are appended and conflicts are represented. The system should not attempt to overwrite a previous contributor's experience with a late-arriving client update.

### Decision: modular monolith plus independently scalable workers

The API and public web experience remain one coherent application. Worker boundaries are explicit, but the system avoids premature microservices and the operational cost of a distributed service mesh.

## Architecture acceptance checks

Before calling the technical foundation complete, verify that:

- A place can be created, searched by radius, and opened by ID.
- A feature can be added to the taxonomy without changing core tables.
- An observation can be stored without exposing the contributor's private profile.
- Claims can be rebuilt from approved observations.
- A conflicting report is represented without deleting either source observation.
- Facility responses are separated from community observations.
- Row-level policies prevent unauthorized reads and writes.
- Evidence originals are not publicly accessible by default.
- The list view can render without map assets.
- Migrations can be applied to a clean database and a populated staging database.
- A failed background job can be retried safely.
- A committed observation creates an outbox event in the same database transaction.
- Redis cache loss leaves the underlying directory and report data available.
- Duplicate offline retries produce one observation through idempotency handling.
- A live incident invalidates only affected route/place caches.
- A route response explains constraints, freshness, and unknown segments.
- Evidence originals are isolated from public derivatives until processing succeeds.
- Queue lag, dead-letter jobs, cache hit ratio, and route invalidation delay are observable.
