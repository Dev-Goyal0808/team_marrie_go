# AccessMap Product Plan

## Document purpose

This document converts the PS03 challenge into an implementation-ready product definition. It describes the people AccessMap serves, the user problems, the first release, the information model, the main user journeys, the trust model, and observable acceptance criteria.

It is intentionally more specific than the README. The README explains the idea quickly; this document explains what the product must do and how people should experience it.

## Product statement

AccessMap is a community-verified accessibility directory for public spaces. It helps a person decide whether a facility is likely to meet their own access needs, and gives them a safe, structured way to report barriers or confirm useful information.

The product must communicate uncertainty honestly. A missing observation is not proof that a feature is absent, and a facility should not receive a single universal accessibility score that hides differences between user needs.

## Product goals

### Primary goal

Help people make better-informed decisions about visiting public spaces before they travel.

### Supporting goals

- Make accessibility information specific, understandable, and dated.
- Give disabled people and other visitors a direct way to contribute observations.
- Create a transparent process for confirming, disputing, and re-checking information.
- Allow facility operators to provide official information without suppressing independent reports.
- Produce structured data that can reveal recurring barriers to communities and local authorities.

## Non-goals for the first release

The MVP should remain focused on reliable information and reporting. The following capabilities may be added later, but should not delay the first complete user flow:

- Automated accessible route planning
- A native mobile application
- Real-time public transport vehicle tracking
- A formal legal accessibility certification
- Automated claims that a place is universally accessible
- Medical or disability diagnosis collection
- Predictive accessibility decisions based only on photographs

## Product principles

### Accessibility is personal

The product should ask, “Which features matter to you?” rather than “Are you disabled?” Access preferences are optional and private.

### Specific information beats a score

“Step-free entrance confirmed; lift unknown; accessible toilet reported unavailable” is more useful than “80% accessible”.

### Freshness matters

Every observation has an observation date. Temporary barriers, transport conditions, lifts, and footpaths may need faster re-checks than permanent building features.

### Evidence increases trust, not certainty

Photos, measurements, facility responses, and independent confirmations can improve confidence. They do not turn a changing public place into a permanent guarantee.

### Unknown must remain visible

The interface must never turn missing data into a green match or a red failure without clearly explaining the difference.

### Community knowledge and official information are complementary

Independent observations and facility responses should appear together, with clear source labels and dates.

### The product must practice what it promotes

Search, filtering, reporting, moderation, and reading results must be accessible to people who use keyboards, screen readers, magnification, voice control, reduced motion, or high-contrast settings.

## Personas

### Persona A: wheelchair user planning a visit

**Context:** Wants to visit a library or government office without discovering at the entrance that there are stairs or a broken lift.

**Needs:** Step-free route, door width, ramp details, lift status, accessible toilet, accessible parking or drop-off, recent observations.

**Product outcome:** Can compare facilities and decide whether to visit, call first, or choose an alternative.

### Persona B: person with a visual impairment

**Context:** Needs to understand whether a route and building provide tactile, audio, and navigational support.

**Needs:** Tactile paving, audio announcements, high-contrast signs, obstacle-free routes, screen-reader-friendly information, staff assistance.

**Product outcome:** Can filter for relevant features and read all essential information without depending on a map image.

### Persona C: deaf or hard-of-hearing visitor

**Context:** Wants to know whether a facility uses visual announcements or offers communication support.

**Needs:** Visual information displays, hearing loop, captioned material, sign-language support, alternative communication.

**Product outcome:** Can identify communication barriers before visiting.

### Persona D: person with sensory or cognitive access needs

**Context:** A busy, loud, unpredictable environment may prevent a successful visit.

**Needs:** Quiet hours, noise level, lighting, crowd level, clear signage, predictable entrance process, quiet room, waiting area.

**Product outcome:** Can assess whether the environment is likely to be manageable and plan support.

### Persona E: caregiver or older adult

**Context:** Is helping another person or managing a stroller, fatigue, or limited walking distance.

**Needs:** Seating, toilet access, short routes, ramps, lifts, clear directions, drop-off details, changing facilities.

**Product outcome:** Can reduce uncertainty and avoid unnecessary physical strain.

### Persona F: community contributor

**Context:** Notices a broken ramp, blocked pavement, or useful accessible service.

**Needs:** A quick, structured, privacy-aware reporting flow with feedback after submission.

**Product outcome:** Can contribute meaningful information without completing a long survey.

### Persona G: facility manager

**Context:** Wants correct public information and a way to communicate temporary problems or planned improvements.

**Needs:** Claim verification, official responses, correction workflow, repair updates, visibility into recurring issues.

**Product outcome:** Can improve the accuracy of the facility profile without controlling independent community history.

### Persona H: moderator or disability organization reviewer

**Context:** Needs to protect the directory from spam, privacy breaches, duplicate places, and misleading claims.

**Needs:** Evidence, history, conflict visibility, moderation actions, audit logs, escalation paths.

**Product outcome:** Can maintain a trustworthy directory without deleting legitimate uncertainty.

## Information architecture

The public product should have the following main areas:

1. **Home and search**
2. **Results: map and accessible list**
3. **Place detail**
4. **Accessibility preferences**
5. **Report or update information**
6. **My contributions**
7. **Facility manager area**
8. **Moderator area**
9. **Help, privacy, and accessibility statement**

The public search and place-detail pages should be usable without signing in. Authentication is required for contributions, saved preferences, and management actions.

## MVP scope

The MVP should demonstrate a technically differentiated, complete journey rather than only a place directory. The directory remains the public entry point, but the first serious product slice should include live barrier state, an offline-capable reporting flow, and an accessibility-aware route preview.

## Differentiated platform capabilities

### AccessFlow — barrier-aware journeys

AccessFlow helps a user plan a journey from an origin to a facility using personal constraints. It should be able to prefer or avoid:

- Stairs
- Steep slopes
- Missing curb ramps
- Narrow paths
- Uneven or loose surfaces
- Broken lifts
- Inaccessible transport stops
- Known temporary barriers
- Long sections without seating
- Routes with stale or unknown access information

The route result must explain its assumptions. It should show the route length, estimated time, constraints satisfied, uncertain segments, and recently reported incidents. It must never present a route as a permanent guarantee of accessibility.

### AccessPulse — live accessibility incidents

AccessPulse represents conditions that may change during the day:

- A lift is broken.
- A ramp is blocked.
- A footpath is under construction.
- A toilet is temporarily closed.
- A transport stop has moved.
- Flooding or an event has affected a route.

Incidents have a lifecycle:

```text
Reported → Validated → Published → Confirmed/disputed → Resolved → Archived
```

An incident should update the affected place, relevant route segments, saved places, and subscribed facility or authority workflows.

### AccessSync — offline-first reporting

The report form should remain useful in locations with poor connectivity. A contributor can save an observation locally, attach a compressed photo, and synchronize it when connectivity returns.

Offline observations must use client-generated idempotency keys. The server should append observations rather than attempting destructive merges, so conflicting reports remain visible for claim review.

### EvidenceGuard — privacy-aware evidence processing

EvidenceGuard is an asynchronous pipeline for uploaded evidence. It should:

- Verify file signatures and allowed media types.
- Remove EXIF metadata.
- Generate a safe public derivative.
- Detect possible faces, license plates, documents, and private text.
- Suggest alt text.
- Optionally suggest a feature or measurement for contributor review.

Automated processing can assist privacy and structure, but it must not independently declare that a place is accessible. A contributor or moderator remains responsible for the final public claim.

### AccessTrust — explainable confidence

AccessTrust evaluates claim quality using transparent dimensions:

- Recency
- Independent agreement
- Source diversity
- Facility confirmation
- Evidence support
- Contributor consistency
- Conflict count

The public interface should explain why a claim has its status rather than showing an unexplained score. Internal calculations should be versioned so that changes to trust rules are auditable.

### Facility operations and QR reporting

Facility operators should be able to manage current conditions, not merely edit a static profile. A facility can place a QR code near an entrance, lift, accessible toilet, or construction barrier. Scanning the code opens a report form already associated with that exact location and feature.

Facility operators can:

- Acknowledge an incident.
- Publish a temporary closure.
- Record a repair update.
- Respond to community observations.
- View repeated barriers and resolution time.

Official responses remain separate from independent observations.

### Civic API and change feed

Once claim and incident events are stable, AccessMap can expose a public API for disability organizations, local authorities, transport agencies, researchers, and civic applications.

Useful public resources include:

- Places and current claim summaries
- Active accessibility incidents
- Accessibility changes since a timestamp
- Barrier resolution timelines
- Route warnings

The API should provide anonymized, rate-limited data and never expose private access preferences or contributor identity details.

### Directory and discovery

The directory must allow a user to:

- Search by facility name or free-text location.
- Search around a selected location when they grant location permission.
- Browse by facility category.
- View results in a map and a list.
- Use the list independently from the map.
- Filter by individual access features.
- Sort by distance or recently observed information.
- Open a place detail page.

### Personal access profile

The user may select preferences under:

- Mobility and movement
- Visual access
- Hearing and communication
- Sensory environment
- Cognitive clarity
- Toilets and personal care
- Transport and outdoor access

Preferences must be:

- Optional
- Private by default
- Editable and removable
- Used only to personalize results unless the user explicitly contributes information

### Place profile

Every place profile should show:

- Name and category
- Address and geographic position
- Contact details and website
- Opening hours when known
- Accessibility information grouped by task
- Barriers and temporary closures
- Source and date for each claim
- Confidence/status label for each claim
- Community observations
- Facility responses
- Photos or evidence where safe and available
- Actions to report an issue or confirm information

### Community observation

A contributor can submit an observation for a specific place and feature. The minimum observation contains:

- The place
- The feature or barrier category
- The observed status
- The observation date
- A short description when needed

Optional information includes:

- Measurement, such as door width
- Temporary/permanent indication
- Photo evidence
- Additional context

### Moderation

Moderators need to review:

- New or suspicious observations
- Photos that may expose people or personal information
- Duplicate place suggestions
- Conflicts between recent observations
- Reports of abuse or inappropriate content
- Facility claim requests

## Accessibility feature taxonomy

The taxonomy should be structured so that it can grow without rewriting the user interface. Each feature has a category, a plain-language label, a machine-readable code, and an input format.

### Entrance and building access

- Step-free entrance
- Number of steps
- Ramp available
- Ramp surface
- Ramp steepness or slope information
- Ramp handrails
- Door width
- Automatic door
- Door opening force
- Threshold height
- Accessible drop-off point
- Accessible parking
- Entrance lighting
- Security gates or turnstiles

### Internal movement

- Lift available
- Lift currently working
- Lift dimensions
- Lift audio announcements
- Lift visual announcements
- Internal stairs
- Handrails
- Corridor width
- Seating along the route
- Floor surface
- Obstructions
- Staff assistance

### Toilets and personal care

- Accessible toilet available
- Toilet on the same floor
- Door width
- Turning space
- Grab rails
- Transfer side
- Emergency pull cord
- Sink height
- Changing table
- Adult changing facility
- Toilet currently operational

### Footpaths and outdoor access

- Pavement condition
- Path width
- Surface type
- Slope
- Curb ramp
- Tactile paving
- Obstruction
- Construction barrier
- Street crossing
- Seating or resting point
- Lighting
- Flooding or weather-related problem

### Public transport

- Accessible stop
- Step-free boarding
- Platform gap
- Low-floor vehicle service
- Audio announcement
- Visual announcement
- Shelter
- Seating
- Tactile markings
- Accessible ticket machine
- Working information display
- Current disruption

### Communication

- Sign-language support
- Hearing loop
- Captioned media
- Braille signage
- Large-print information
- Easy-read information
- Staff trained in disability support
- Alternative communication method
- Language support

### Sensory and cognitive environment

- Quiet space
- Quiet hours
- Noise level
- Lighting conditions
- Flickering-light risk
- Crowd level
- Clear signage
- Simple layout
- Predictable entrance process
- Waiting area
- Advance booking requirements
- Staff assistance

## Journey and access graph model

For route planning, a place is not one point on a map. It is a set of access nodes and connections:

- Building entrances
- Lifts
- Accessible toilets
- Transport stops
- Curb crossings
- Footpath segments
- Internal connectors
- Destination rooms or service counters

An access connection can have properties such as:

- Surface type
- Width
- Slope
- Steps
- Curb ramp availability
- Last observation date
- Current barriers
- Confidence status

The route experience should distinguish hard constraints from preferences. For example, stairs may be a hard exclusion while a longer route or a noisier route may be a preference. A user should be able to understand why a route was selected and which segments require caution.

## Accessibility incident model

An incident is a time-bounded change or barrier associated with a place, access node, feature, or route segment.

Required incident fields:

- Affected entity
- Incident type
- Severity
- Reporter/source
- Start time
- Expected expiry or review time
- Current status
- Evidence or explanation

The interface should make temporary status visible without replacing the permanent feature record. For example, a lift can remain a permanent feature while also having an active “temporarily unavailable” incident.

## Trust and status model

AccessMap should calculate status at the **feature-claim level**. A facility can therefore have different statuses for its entrance, lift, toilet, path, and communication services.

### Status definitions

| Status | User-facing meaning | Typical trigger |
| --- | --- | --- |
| Not assessed | There is not enough information yet. | No valid observation exists. |
| Community reported | Someone has reported this condition. | One valid observation. |
| Recently observed | The condition has a recent observation date. | Observation is inside the feature freshness window. |
| Community corroborated | Independent observations agree. | Two or more independent observations agree. |
| Facility confirmed | A verified facility representative confirmed the claim. | Approved facility response. |
| Temporarily unavailable | The feature exists but cannot currently be used. | Recent temporary-unavailability report or official update. |
| Conflicting information | Recent observations disagree. | Two materially different current claims. |
| Needs re-verification | Information may no longer be reliable. | Stale claim or unresolved challenge. |
| Resolved | A previous barrier has a newer positive update. | New observation confirms the change. |

### Status presentation rules

- Always show the source and observation date.
- Never use color alone to communicate status.
- Do not display a single overall green “accessible” score.
- Show unknown information explicitly.
- Put temporary problems near the relevant feature, not in an unrelated notice.
- Keep conflicts visible until they are resolved or become stale.
- Explain what a confidence label means when a user selects it.

### Freshness configuration

Freshness should be configurable per feature type. Suggested starting values:

| Information type | Initial re-check period |
| --- | ---: |
| Transport disruption or temporary barrier | 7–30 days |
| Lift operation | 30–60 days |
| Footpath condition | 30–90 days |
| Toilet operation | 90–180 days |
| Permanent building feature | 180–365 days |

These are operational defaults, not guarantees. The product should use “last observed” language rather than promise that a place remains accessible.

## Primary user journeys

### Journey 1: Find a suitable place

1. The user opens AccessMap.
2. They search for a category, place, or location.
3. They optionally select private access preferences.
4. The system shows nearby results in a list and map.
5. Each result summarizes known matches, unknowns, recent issues, and data freshness.
6. The user opens a place page.
7. They review feature-level information and decide whether to visit, contact the facility, or choose another place.

**Success condition:** The user can make a more informed decision without needing to discover every access condition in person.

### Journey 2: Report a barrier

1. The contributor opens a place page or chooses a nearby place.
2. They select **Report an issue**.
3. They choose the affected feature.
4. They select a structured status such as unavailable, blocked, partially accessible, or incorrect information.
5. They add the observation date and short details.
6. They optionally add a measurement or evidence photo.
7. The product gives privacy guidance before upload.
8. The contributor reviews visibility and submits.
9. The system shows a status such as pending review or community reported.
10. The contributor can later see whether the report was accepted, challenged, or corroborated.

**Success condition:** A visitor can report meaningful information in a few focused steps without having to complete an exhausting survey.

### Journey 3: Confirm or dispute a claim

1. The user opens a feature on a place page.
2. They select **Confirm**, **Dispute**, or **Mark outdated**.
3. The product asks only the questions relevant to that feature.
4. The user adds the date and optional context.
5. The system records an independent verification event.
6. The claim status updates transparently.

**Success condition:** The directory becomes more useful over time without hiding disagreement.

### Journey 4: Facility response

1. A facility representative requests to claim a place.
2. A moderator verifies the relationship using an official contact method.
3. The representative reviews feature-level claims.
4. They confirm, correct, or temporarily update information.
5. The public sees the response with a facility-confirmed label and date.
6. Independent observations remain in the history.

**Success condition:** Facilities can improve accuracy and communicate changes without having unilateral control over community data.

### Journey 5: Moderator resolution

1. The moderation queue identifies a report, image, duplicate, abuse flag, or conflict.
2. The moderator reviews the report, history, evidence, and related observations.
3. The moderator approves, rejects, requests changes, merges, hides sensitive evidence, or escalates.
4. The system records the action in the audit log.
5. The public status changes with an understandable explanation where appropriate.

**Success condition:** Moderators can protect trust and privacy while preserving legitimate uncertainty and history.

### Journey 6: Plan a barrier-aware journey

1. The user selects an origin and destination place.
2. The user chooses or loads private route constraints.
3. The system calculates route alternatives.
4. Each route shows time, distance, constraints satisfied, uncertainty, and active barriers.
5. The user selects a route and expands individual segments.
6. A new live incident appears while the route is open.
7. The application marks affected routes stale and offers recalculation.

**Success condition:** The user can understand the trade-off between speed, accessibility constraints, and data uncertainty before leaving.

### Journey 7: Report while offline

1. The contributor opens the cached report flow.
2. They select a place or scan a facility QR code.
3. They record an observation and optionally attach a compressed photo.
4. The application stores a local draft with a client request ID.
5. The user receives a clear “saved on this device” state.
6. When connectivity returns, the application synchronizes the report.
7. The server deduplicates retries using the idempotency key.
8. The contributor receives a server-confirmed status.

**Success condition:** Poor connectivity does not cause a lost observation or duplicate report.

## Detailed functional requirements

### Search and discovery

**FR-01:** Users can search by place name, category, or location.

**FR-02:** Users can search near their current position only after granting browser location permission.

**FR-03:** Users can search without granting location permission by entering a city, address, landmark, or map area.

**FR-04:** Results are available in both map and list formats.

**FR-05:** The list view includes the same essential information as the map view.

**FR-06:** Users can filter using individual accessibility features.

**FR-07:** Unknown information is not treated as a positive match.

**FR-08:** Users can sort results by distance and recently observed data.

**FR-09:** Empty, slow, invalid, and failed searches have clear recovery actions.

### Journey planning and live incidents

**FR-09A:** Users can request a route between an origin and a destination place.

**FR-09B:** Users can select route constraints such as avoiding stairs, limiting slope, requiring curb ramps, or avoiding known barriers.

**FR-09C:** Each route explains distance, estimated time, satisfied constraints, unknown segments, and active incidents.

**FR-09D:** The system does not describe a route as permanently guaranteed accessible.

**FR-09E:** A published incident can be linked to a place, access node, or route segment.

**FR-09F:** Active incidents show severity, source, observation time, and expected review or expiry time.

**FR-09G:** A route currently open in the browser receives live updates when a relevant incident changes.

**FR-09H:** The user can recalculate an affected route without losing their selected constraints.

### Accessibility preferences

**FR-10:** Users can create an optional access profile.

**FR-11:** Users can edit, clear, or skip their profile.

**FR-12:** Access preferences are private by default.

**FR-13:** Personalized results explain which preferences are matched, unknown, or not met.

**FR-14:** Users can use manual filters without creating an account.

### Place information

**FR-15:** A place page displays basic identity, address, category, and contact information.

**FR-16:** A place page displays each known accessibility feature with source, status, and observation date.

**FR-17:** A place page distinguishes community observations from facility responses.

**FR-18:** A place page shows temporary barriers and conflicting information prominently.

**FR-19:** A place page shows when information is stale or needs re-verification.

**FR-20:** A place page provides actions to report, confirm, dispute, or mark information outdated.

### Contributions

**FR-21:** Authenticated users can create structured observations.

**FR-22:** Observations require a place, feature, status, and observation date.

**FR-23:** Users can add a description and optional measurement.

**FR-24:** Users can attach optional evidence subject to file and privacy checks.

**FR-25:** Users can view their own contribution history and statuses.

**FR-26:** Users can request a correction or removal of their own contribution.

**FR-26A:** The report form can be loaded from cached application data when the device is offline.

**FR-26B:** Offline reports have a local draft state distinct from server-confirmed submission.

**FR-26C:** Synchronization retries use an idempotency key and do not create duplicate observations.

**FR-26D:** Users can see whether a report is saved locally, syncing, server-confirmed, or failed.

**FR-26E:** Evidence processing can remove metadata and place sensitive media into moderation before public display.

**FR-26F:** Automated evidence assistance may suggest alt text, a feature, or a measurement, but the user or moderator controls the final public content.

### Moderation and facility management

**FR-27:** Moderators can review pending reports and evidence.

**FR-28:** Moderators can approve, reject, request changes, hide evidence, and merge duplicates.

**FR-29:** Moderators can see related observations before resolving a conflict.

**FR-30:** Facility representatives can request a place claim.

**FR-31:** Verified facility representatives can publish official responses.

**FR-32:** Facility responses cannot silently delete independent observations.

**FR-33:** Important moderation and status changes are auditable.

**FR-34:** A facility representative can create an incident for a verified place.

**FR-35:** A facility representative can mark an incident acknowledged, resolved, or awaiting repair without deleting the original observation.

**FR-36:** A facility QR code can open a report flow pre-associated with a place and feature.

**FR-37:** Public API consumers can request active incidents and accessibility changes using documented, rate-limited endpoints.

**FR-38:** API responses exclude private access profiles, contributor contact details, moderation notes, and unapproved evidence.

**FR-39:** Public API consumers can subscribe to approved change events through authenticated webhooks where enabled.

## Non-functional requirements

### Accessibility

- Target WCAG 2.2 AA.
- Support keyboard-only operation.
- Support screen-reader navigation.
- Provide visible focus indicators.
- Avoid color-only communication.
- Support text resize and high zoom.
- Respect reduced-motion settings.
- Provide an accessible alternative to all map-only interactions.

### Privacy

- Minimize account and profile data.
- Do not require disability diagnoses.
- Keep personal access preferences private.
- Strip photo metadata before public display.
- Prevent public display of unnecessary reporter location.
- Provide deletion and correction paths.

### Performance

- Server-render public place pages where practical.
- Load the directory list before heavy map assets.
- Use image resizing and lazy loading.
- Provide a usable experience on slow connections.
- Keep filters and place detail interactions responsive on mobile.

### Trust and reliability

- Preserve observation history.
- Make status changes explainable.
- Show dates for all meaningful claims.
- Rate-limit abuse-prone endpoints.
- Log privileged actions.

### Resilience and platform behavior

- PostgreSQL remains the durable source of truth.
- Redis/Valkey may cache and queue work, but Redis loss must not delete observations.
- Report submissions use idempotency keys.
- Background jobs are retryable and idempotent.
- Failed jobs move to a visible dead-letter or manual-review state.
- Live updates may degrade to manual refresh without blocking the core directory.
- Offline reports distinguish local, syncing, confirmed, and failed states.
- Public APIs use versioned schemas and bounded pagination.

### Observability

- Propagate a trace ID from browser request through API, database, Redis, workers, and external integrations.
- Measure queue lag, cache hit ratio, route invalidation delay, report synchronization failures, and evidence-processing time.
- Alert on failed jobs and privacy-processing failures, not only HTTP errors.

## Empty, invalid, and failure states

The product plan is incomplete unless these states are designed:

### No results

Explain that no matching place was found and offer:

- Broader search
- Nearby categories
- Clear filters
- Suggest a missing place

### No accessibility information

Display:

> This place has not been assessed for these features yet. You can contact the facility or contribute an observation.

Do not show a green or red overall result.

### Stale information

Display:

> This information may have changed. Last observed on [date]. Please verify before relying on it.

### Conflicting reports

Display both the conflict and the relevant dates:

> Recent observations disagree about this feature. Check with the facility before visiting or add a new observation.

### Location permission denied

Allow manual location search and explain that the user can change browser permission later.

### Report validation failure

Identify the specific missing or invalid field, preserve entered information, and avoid clearing the entire form.

### Photo upload failure

Allow the user to continue without the photo, retry, or save a draft if supported.

### Network failure

Explain whether the report was saved, not saved, or needs retrying. Never imply successful submission without server confirmation.

### Offline report saved

Display:

> Saved on this device. It will be submitted when you reconnect.

Provide a contribution queue where the user can retry, edit, or remove the local draft. Do not label it community reported until the server accepts it.

### Route contains unknown segments

Display the route with a clear caution:

> This route includes segments that have not been assessed recently. Review the segment details or choose another route.

Unknown route information must not be silently treated as accessible.

### Live incident during route planning

Announce the change in an accessible status region and provide explicit actions:

- Review incident
- Recalculate route
- Keep current route

Do not move the user automatically without explaining what changed.

### Evidence needs review

Display:

> Your report was received, but the photo is waiting for privacy review. The observation itself is still visible in your contribution history.

This prevents a media-processing delay from looking like a lost report.

## Content and language guidelines

- Use plain, direct language.
- Prefer “step-free entrance” over unexplained technical terms.
- Explain measurements with examples where useful.
- Use “person with a disability” or the language preferred by the local community; avoid assuming one universal preference.
- Never describe a place as “safe for everyone”.
- Avoid language that treats disabled people as a single group.
- Explain uncertainty without blaming the person who needs information.
- Keep labels stable across search, forms, and details.

## Product acceptance criteria

The MVP can be considered product-complete when all of the following are true:

- A visitor can find a place by category and location.
- A visitor can use list mode without a map.
- A visitor can filter for at least one access feature.
- A visitor can distinguish confirmed, reported, unknown, stale, temporary, and conflicting information.
- A visitor can read the last observed date for a claim.
- An authenticated contributor can submit a structured observation.
- A contributor can see the status of their observation.
- Another contributor can confirm or dispute an observation.
- A moderator can resolve a pending report.
- A facility representative can publish a separate official response after verification.
- Access preferences are not visible to other users by default.
- The critical user flow works with keyboard navigation and a screen reader.
- The application has tests for search, reporting, verification, permissions, and accessibility regressions.
- A user can request a route with at least one accessibility constraint.
- A route explains active barriers and unknown segments.
- A live incident can update an open place or route view without a full page reload.
- A contributor can save a report offline and synchronize it exactly once after reconnecting.
- Redis failure does not lose a report already committed to PostgreSQL.
- Evidence metadata is removed before a public derivative is available.
- A facility can acknowledge and resolve a barrier without deleting community history.
- A documented public API can return current incidents without exposing private data.
- Queue lag, cache hit ratio, and failed worker jobs are visible to operators.

## Pilot feedback questions

Before expanding beyond the first pilot area, ask:

- Could users find the information they actually needed?
- Did users understand the difference between unknown and unavailable?
- Were the feature labels clear to people with different access needs?
- Did contributors complete reports without excessive effort?
- Did facility managers understand the difference between responding and deleting?
- Were reports current enough to support real decisions?
- Which missing feature caused the most failed visits?
- Which parts of the interface were difficult with assistive technology?
- Did route explanations help users choose between a fast route and a more suitable route?
- Did live incident updates arrive in time to affect a real decision?
- Did offline synchronization prevent duplicate or lost reports?
- Did facility operators understand the incident-resolution workflow?
