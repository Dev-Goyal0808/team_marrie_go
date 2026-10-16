import { randomUUID } from 'node:crypto';
import { withDatabase, withTransaction } from './pool.mjs';

function mapObservation(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    featureCode: row.feature_code,
    value: row.value,
    details: row.details ?? null,
    measuredValue: row.measured_value ?? null,
    observedAt: row.observed_at,
    submittedAt: row.submitted_at,
    status: row.moderation_status,
    visibility: row.visibility,
    clientRequestId: row.client_request_id ?? null,
    sampleData: Boolean(row.is_sample)
  };
}

export class ObservationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByClientRequestId(userId, clientRequestId) {
    if (!clientRequestId) return null;
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT o.id, o.place_id, f.code AS feature_code, o.value, o.details,
              o.measured_value, o.observed_at, o.submitted_at, o.moderation_status,
              o.visibility, o.client_request_id, o.is_sample
         FROM observations o
         JOIN accessibility_features f ON f.id = o.feature_id
        WHERE o.contributor_id = $1 AND o.client_request_id = $2`,
      [userId, clientRequestId]
    ));
    return result.rows[0] ? mapObservation(result.rows[0]) : null;
  }

  async createObservation(userId, input) {
    return withTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT o.id, o.place_id, f.code AS feature_code, o.value, o.details,
                o.measured_value, o.observed_at, o.submitted_at, o.moderation_status,
                o.visibility, o.client_request_id, o.is_sample
           FROM observations o
           JOIN accessibility_features f ON f.id = o.feature_id
          WHERE o.contributor_id = $1 AND o.client_request_id = $2
          FOR SHARE`,
        [userId, input.clientRequestId]
      );
      if (existing.rows[0]) return { observation: mapObservation(existing.rows[0]), duplicate: true };

      const feature = await client.query(
        `SELECT id, code FROM accessibility_features WHERE code = $1 AND is_active = true`,
        [input.featureCode]
      );
      if (!feature.rows[0]) {
        const error = new Error('The requested accessibility feature does not exist.');
        error.code = 'FEATURE_NOT_FOUND';
        error.status = 422;
        throw error;
      }
      const place = await client.query(
        `SELECT id FROM places WHERE id = $1 AND status IN ('active', 'temporarily_closed')`,
        [input.placeId]
      );
      if (!place.rows[0]) {
        const error = new Error('The requested place does not exist or is not reportable.');
        error.code = 'PLACE_NOT_FOUND';
        error.status = 404;
        throw error;
      }

      const inserted = await client.query(
        `INSERT INTO observations
          (place_id, feature_id, contributor_id, value, details, measured_value,
           observed_at, source_type, client_request_id, visibility, moderation_status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'community', $8, 'public', 'pending')
         RETURNING id, place_id, feature_id, value, details, measured_value,
                   observed_at, submitted_at, moderation_status, visibility,
                   client_request_id, is_sample`,
        [
          input.placeId,
          feature.rows[0].id,
          userId,
          input.value,
          input.details ?? null,
          input.measuredValue ? JSON.stringify(input.measuredValue) : null,
          input.observedAt,
          input.clientRequestId
        ]
      );
      const row = inserted.rows[0];
      await client.query(
        `INSERT INTO moderation_items (entity_type, entity_id, reason, priority)
         VALUES ('observation', $1, $2, $3)`,
        [row.id, input.value === 'unknown' ? 'other' : 'other', 'normal']
      );
      await client.query(
        `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('observation.submitted', 'observation', $1, $2::jsonb)`,
        [row.id, JSON.stringify({
          observationId: row.id,
          placeId: row.place_id,
          featureCode: input.featureCode,
          value: input.value,
          observedAt: input.observedAt
        })]
      );
      return {
        observation: mapObservation({ ...row, feature_code: input.featureCode }),
        duplicate: false
      };
    });
  }

  async listForUser(userId, { page = 1, pageSize = 20 } = {}) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT o.id, o.place_id, f.code AS feature_code, o.value, o.details,
              o.measured_value, o.observed_at, o.submitted_at, o.moderation_status,
              o.visibility, o.client_request_id, o.is_sample
         FROM observations o
         JOIN accessibility_features f ON f.id = o.feature_id
        WHERE o.contributor_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, pageSize, (page - 1) * pageSize]
    ));
    const count = await withDatabase(this.pool, (client) => client.query(
      `SELECT count(*)::integer AS total FROM observations WHERE contributor_id = $1`,
      [userId]
    ));
    const total = count.rows[0]?.total ?? 0;
    return {
      items: result.rows.map(mapObservation),
      pagination: { page, pageSize, total, hasNext: page * pageSize < total }
    };
  }

  async getById(observationId) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT o.id, o.place_id, f.code AS feature_code, o.value, o.details,
              o.measured_value, o.observed_at, o.submitted_at, o.moderation_status,
              o.visibility, o.client_request_id, o.is_sample, o.contributor_id
         FROM observations o
         JOIN accessibility_features f ON f.id = o.feature_id
        WHERE o.id = $1`,
      [observationId]
    ));
    return result.rows[0] ?? null;
  }

  async verify(userId, observationId, eventType, comment = null) {
    return withTransaction(this.pool, async (client) => {
      const observation = await client.query(
        `SELECT o.id, o.place_id, o.feature_id, f.code AS feature_code,
                o.contributor_id
           FROM observations o
           JOIN accessibility_features f ON f.id = o.feature_id
          WHERE o.id = $1
          FOR SHARE`,
        [observationId]
      );
      if (!observation.rows[0]) {
        const error = new Error('Observation not found.');
        error.status = 404;
        error.code = 'OBSERVATION_NOT_FOUND';
        throw error;
      }
      await client.query(
        `INSERT INTO verification_events (observation_id, user_id, event_type, comment)
         VALUES ($1, $2, $3, $4)`,
        [observationId, userId, eventType, comment]
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'observation', $3, $4::jsonb)`,
        [userId, `observation.${eventType}`, observationId, JSON.stringify({ comment: comment ?? null })]
      );
      await client.query(
        `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, 'observation', $2, $3::jsonb)`,
        [
          `observation.${eventType}`,
          observationId,
          JSON.stringify({
            observationId,
            placeId: observation.rows[0].place_id,
            featureCode: observation.rows[0].feature_code,
            verifierId: userId
          })
        ]
      );
      return {
        observationId,
        placeId: observation.rows[0].place_id,
        featureCode: observation.rows[0].feature_code,
        eventType
      };
    });
  }

  async moderate({ moderatorId, itemId, action, resolution = null }) {
    const actionMap = {
      approve: { observationStatus: 'approved', itemStatus: 'resolved', event: 'observation.approved' },
      reject: { observationStatus: 'rejected', itemStatus: 'resolved', event: 'observation.rejected' },
      'request-changes': { observationStatus: 'changes_requested', itemStatus: 'resolved', event: 'observation.changes_requested' },
      escalate: { observationStatus: null, itemStatus: 'escalated', event: null }
    };
    const selected = actionMap[action];
    if (!selected) {
      const error = new Error('Unsupported moderation action.');
      error.status = 422;
      error.code = 'INVALID_MODERATION_ACTION';
      throw error;
    }
    return withTransaction(this.pool, async (client) => {
      const item = await client.query(
        `SELECT m.id, m.entity_type, m.entity_id, o.place_id, f.code AS feature_code
           FROM moderation_items m
           LEFT JOIN observations o ON o.id = m.entity_id AND m.entity_type = 'observation'
           LEFT JOIN accessibility_features f ON f.id = o.feature_id
          WHERE m.id = $1
          FOR UPDATE`,
        [itemId]
      );
      if (!item.rows[0]) {
        const error = new Error('Moderation item not found.');
        error.status = 404;
        error.code = 'MODERATION_ITEM_NOT_FOUND';
        throw error;
      }
      const row = item.rows[0];
      await client.query(
        `UPDATE moderation_items
            SET status = $2, resolution = $3, assigned_to = $4,
                resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END
          WHERE id = $1`,
        [itemId, selected.itemStatus, resolution, moderatorId]
      );
      if (selected.observationStatus) {
        await client.query(
          `UPDATE observations SET moderation_status = $2, visibility = CASE WHEN $2 = 'approved' THEN 'public' ELSE visibility END WHERE id = $1`,
          [row.entity_id, selected.observationStatus]
        );
      }
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'moderation_item', $3, $4::jsonb)`,
        [moderatorId, `moderation.${action}`, itemId, JSON.stringify({ resolution })]
      );
      if (selected.event) {
        await client.query(
          `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
           VALUES ($1, 'observation', $2, $3::jsonb)`,
          [selected.event, row.entity_id, JSON.stringify({
            observationId: row.entity_id,
            placeId: row.place_id,
            featureCode: row.feature_code,
            moderatorId
          })]
        );
      }
      return { itemId, action, status: selected.itemStatus };
    });
  }

  async recomputeClaim(placeId, featureCode) {
    return withTransaction(this.pool, async (client) => {
      const feature = await client.query(
        `SELECT id, freshness_days FROM accessibility_features WHERE code = $1`,
        [featureCode]
      );
      if (!feature.rows[0]) return null;
      const featureId = feature.rows[0].id;
      const observations = await client.query(
        `SELECT value, observed_at, contributor_id
           FROM observations
          WHERE place_id = $1 AND feature_id = $2
            AND visibility = 'public' AND moderation_status = 'approved'
          ORDER BY observed_at DESC`,
        [placeId, featureId]
      );
      const latest = observations.rows[0] ?? null;
      const freshnessLimit = Date.now() - Number(feature.rows[0].freshness_days) * 86_400_000;
      const fresh = latest && new Date(latest.observed_at).getTime() >= freshnessLimit;
      const values = new Set(observations.rows.filter((row) => fresh || row === latest).map((row) => row.value));
      const supportingCount = new Set(observations.rows.filter((row) => row.value === 'yes').map((row) => row.contributor_id)).size;
      const disputingCount = new Set(observations.rows.filter((row) => row.value === 'no' || row.value === 'temporarily_unavailable').map((row) => row.contributor_id)).size;
      const conflict = values.has('yes') && (values.has('no') || values.has('temporarily_unavailable'));
      let status = 'not_assessed';
      let summaryValue = 'unknown';
      let freshnessState = 'needs_reverification';
      if (latest) {
        freshnessState = fresh ? 'fresh' : 'stale';
        if (!fresh) status = 'needs_reverification';
        else if (conflict) status = 'conflicting_information';
        else if (latest.value === 'temporarily_unavailable') status = 'temporarily_unavailable';
        else if (latest.value === 'no') status = 'community_reported';
        else if (supportingCount > 1) status = 'community_corroborated';
        else status = 'recently_observed';
        summaryValue = conflict ? 'unknown' : latest.value;
      }
      const existing = await client.query(
        `SELECT id, claims_version FROM claims WHERE place_id = $1 AND feature_id = $2 FOR UPDATE`,
        [placeId, featureId]
      );
      let row;
      if (existing.rows[0]) {
        const updated = await client.query(
          `UPDATE claims
              SET status = $3, summary_value = $4, latest_observed_at = $5,
                  freshness_state = $6, supporting_count = $7, disputing_count = $8,
                  claims_version = claims.claims_version + 1
            WHERE id = $1
            RETURNING id, claims_version, calculation_version`,
          [existing.rows[0].id, placeId, status, summaryValue, latest?.observed_at ?? null, freshnessState, supportingCount, disputingCount]
        );
        row = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO claims
            (place_id, feature_id, status, summary_value, latest_observed_at,
             freshness_state, supporting_count, disputing_count, claims_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
           RETURNING id, claims_version, calculation_version`,
          [placeId, featureId, status, summaryValue, latest?.observed_at ?? null, freshnessState, supportingCount, disputingCount]
        );
        row = inserted.rows[0];
      }
      await client.query(
        `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('claim.recomputed', 'claim', $1, $2::jsonb)`,
        [row.id, JSON.stringify({ placeId, featureCode, claimsVersion: row.claims_version })]
      );
      return { id: row.id, placeId, featureCode, status, summaryValue, claimsVersion: Number(row.claims_version) };
    });
  }
}

export function observationClientRequestId(input) {
  return input.clientRequestId ?? input.client_request_id ?? randomUUID();
}
