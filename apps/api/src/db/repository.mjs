import { randomUUID } from 'node:crypto';
import { withDatabase, withTransaction } from './pool.mjs';

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
}

function mapPlace(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category_code,
    categoryLabel: row.category_label,
    address: row.address,
    city: row.city,
    description: row.description ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: row.distance_meters === null || row.distance_meters === undefined
      ? undefined
      : Number(row.distance_meters),
    sampleData: Boolean(row.is_sample),
    claimSummary: row.claim_summary ?? [],
    activeIncidents: row.active_incidents ?? []
  };
}

function mapClaim(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    featureCode: row.feature_code,
    featureLabel: row.feature_label,
    status: row.status,
    summaryValue: row.summary_value,
    source: row.source ?? 'community',
    observedAt: row.latest_observed_at,
    freshnessState: row.freshness_state,
    supportingCount: Number(row.supporting_count ?? 0),
    disputingCount: Number(row.disputing_count ?? 0),
    claimsVersion: Number(row.claims_version ?? 1),
    calculationVersion: Number(row.calculation_version ?? 1)
  };
}

function mapIncident(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    accessNodeId: row.access_node_id ?? null,
    accessEdgeId: row.access_edge_id ?? null,
    featureId: row.feature_id ?? null,
    incidentType: row.incident_type,
    severity: row.severity,
    status: row.status,
    description: row.description ?? null,
    startsAt: row.starts_at,
    reviewAt: row.review_at,
    resolvedAt: row.resolved_at ?? null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude)
  };
}

export class SqlRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getUserByAuthSubject(authSubject) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT id, auth_subject, email, display_name, role, status
         FROM users
        WHERE auth_subject = $1`,
      [authSubject]
    ));
    return result.rows[0] ?? null;
  }

  async getUserById(id) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT id, auth_subject, email, display_name, role, status
         FROM users
        WHERE id = $1`,
      [id]
    ));
    return result.rows[0] ?? null;
  }

  async health() {
    const result = await withDatabase(this.pool, (client) => client.query('SELECT 1 AS ok'));
    return result.rows[0]?.ok === 1;
  }

  async listCategories() {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT code, name
         FROM place_categories
        WHERE is_active = true
        ORDER BY name`
    ));
    return result.rows;
  }

  async listFeatures() {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT code, category, label, description, input_type AS "inputType", freshness_days AS "freshnessDays"
         FROM accessibility_features
        WHERE is_active = true
        ORDER BY category, label`
    ));
    return result.rows;
  }

  async searchPlaces({
    query = '',
    category = null,
    city = null,
    latitude = null,
    longitude = null,
    radius = null,
    bbox = null,
    features = [],
    page = 1,
    pageSize = 20,
    sort = 'distance'
  } = {}) {
    const values = [];
    const conditions = ["p.status IN ('active', 'temporarily_closed')"];
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (query) {
      const placeholder = add(`%${query}%`);
      conditions.push(`(p.name ILIKE ${placeholder} OR p.address ILIKE ${placeholder} OR p.city ILIKE ${placeholder})`);
    }
    if (category) conditions.push(`c.code = ${add(category)}`);
    if (city) conditions.push(`p.city ILIKE ${add(`%${city}%`)}`);
    if (latitude !== null && longitude !== null && radius !== null) {
      const point = `ST_SetSRID(ST_Point(${add(longitude)}, ${add(latitude)}), 4326)::geography`;
      conditions.push(`ST_DWithin(p.geom, ${point}, ${add(radius)})`);
    }
    if (bbox) {
      conditions.push(`ST_Intersects(
        p.geom,
        ST_SetSRID(ST_MakeEnvelope(${add(bbox.minLongitude)}, ${add(bbox.minLatitude)}, ${add(bbox.maxLongitude)}, ${add(bbox.maxLatitude)}), 4326)::geography
      )`);
    }
    for (const featureCode of asArray(features)) {
      conditions.push(`EXISTS (
        SELECT 1
          FROM claims feature_filter_claim
          JOIN accessibility_features feature_filter ON feature_filter.id = feature_filter_claim.feature_id
         WHERE feature_filter_claim.place_id = p.id
           AND feature_filter.code = ${add(featureCode)}
           AND feature_filter_claim.summary_value = 'yes'
           AND feature_filter_claim.freshness_state = 'fresh'
      )`);
    }

    const distanceExpression = latitude !== null && longitude !== null
      ? `ST_Distance(p.geom, ST_SetSRID(ST_Point(${add(longitude)}, ${add(latitude)}), 4326)::geography)`
      : 'NULL';
    const orderBy = sort === 'freshness'
      ? 'p.updated_at DESC, p.name ASC'
      : latitude !== null && longitude !== null
        ? 'distance_meters ASC NULLS LAST, p.name ASC'
        : 'p.name ASC';
    const where = conditions.join(' AND ');
    const countResult = await withDatabase(this.pool, (client) => client.query(
      `SELECT count(*)::integer AS total
         FROM places p
         JOIN place_categories c ON c.id = p.category_id
        WHERE ${where}`,
      values
    ));
    const total = countResult.rows[0]?.total ?? 0;
    const offset = (page - 1) * pageSize;
    const limitPlaceholder = add(pageSize);
    const offsetPlaceholder = add(offset);
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT
         p.id, p.name, c.code AS category_code, c.name AS category_label,
         p.address, p.city, p.description, p.latitude, p.longitude, p.is_sample,
         ${distanceExpression} AS distance_meters,
         COALESCE((
           SELECT json_agg(json_build_object(
             'featureCode', f.code,
             'status', cl.status,
             'summaryValue', cl.summary_value,
             'observedAt', cl.latest_observed_at,
             'freshnessState', cl.freshness_state
           ) ORDER BY f.code)
           FROM claims cl
           JOIN accessibility_features f ON f.id = cl.feature_id
          WHERE cl.place_id = p.id
         ), '[]'::json) AS claim_summary,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', b.id,
             'type', b.incident_type,
             'severity', b.severity,
             'status', b.status,
             'reviewAt', b.review_at
           ) ORDER BY b.review_at)
           FROM barrier_events b
          WHERE b.place_id = p.id
            AND b.status IN ('reported', 'validated', 'published', 'disputed')
         ), '[]'::json) AS active_incidents
       FROM places p
       JOIN place_categories c ON c.id = p.category_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      values
    ));
    return {
      items: result.rows.map(mapPlace),
      pagination: { page, pageSize, total, hasNext: offset + result.rows.length < total }
    };
  }

  async getPlace(placeId) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT p.id, p.name, c.code AS category_code, c.name AS category_label,
              p.address, p.city, p.postal_code, p.description, p.latitude,
              p.longitude, p.phone, p.website, p.opening_hours, p.source,
              p.status, p.is_sample
         FROM places p
         JOIN place_categories c ON c.id = p.category_id
        WHERE p.id = $1
          AND p.status IN ('active', 'temporarily_closed')`,
      [placeId]
    ));
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...mapPlace(row),
      postalCode: row.postal_code,
      phone: row.phone,
      website: row.website,
      openingHours: row.opening_hours,
      source: row.source,
      status: row.status,
      claims: await this.listClaims(placeId),
      incidents: await this.listIncidents({ placeId }),
      accessGraph: await this.getAccessGraph(placeId)
    };
  }

  async listClaims(placeId) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT cl.id, cl.place_id, f.code AS feature_code, f.label AS feature_label,
              cl.status, cl.summary_value, cl.latest_observed_at, cl.freshness_state,
              cl.supporting_count, cl.disputing_count, cl.claims_version,
              cl.calculation_version,
              CASE WHEN cl.status = 'facility_confirmed' THEN 'facility' ELSE 'community' END AS source
         FROM claims cl
         JOIN accessibility_features f ON f.id = cl.feature_id
        WHERE cl.place_id = $1
        ORDER BY f.category, f.label`,
      [placeId]
    ));
    return result.rows.map(mapClaim);
  }

  async listIncidents({ placeId = null, bbox = null } = {}) {
    const values = [];
    const conditions = ["b.status IN ('reported', 'validated', 'published', 'disputed', 'resolved', 'archived')"];
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (placeId) conditions.push(`b.place_id = ${add(placeId)}`);
    if (bbox) {
      conditions.push(`ST_Intersects(
        b.geom,
        ST_SetSRID(ST_MakeEnvelope(${add(bbox.minLongitude)}, ${add(bbox.minLatitude)}, ${add(bbox.maxLongitude)}, ${add(bbox.maxLatitude)}), 4326)::geography
      )`);
    }
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT b.id, b.place_id, b.access_node_id, b.access_edge_id, b.feature_id,
              b.incident_type, b.severity, b.status, b.description, b.starts_at,
              b.review_at, b.resolved_at,
              ST_Y(ST_Centroid(b.geom::geometry)) AS latitude,
              ST_X(ST_Centroid(b.geom::geometry)) AS longitude
         FROM barrier_events b
        WHERE ${conditions.join(' AND ')}
        ORDER BY b.starts_at DESC`,
      values
    ));
    return result.rows.map(mapIncident);
  }

  async getAccessGraph(placeId) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT id, place_id, node_type, label, floor, status,
              ST_Y(geom::geometry) AS latitude, ST_X(geom::geometry) AS longitude
         FROM access_nodes
        WHERE place_id = $1
          AND status IN ('active', 'unknown')
        ORDER BY label`,
      [placeId]
    ));
    const edges = await withDatabase(this.pool, (client) => client.query(
      `SELECT id, from_node_id, to_node_id, surface_type, width_meters,
              slope_percent, stairs, step_free, last_observed_at, status
         FROM access_edges
        WHERE from_node_id IN (SELECT id FROM access_nodes WHERE place_id = $1)
          AND to_node_id IN (SELECT id FROM access_nodes WHERE place_id = $1)
        ORDER BY id`,
      [placeId]
    ));
    return {
      nodes: result.rows.map((row) => ({
        id: row.id,
        type: row.node_type,
        label: row.label,
        floor: row.floor,
        status: row.status,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude)
      })),
      edges: edges.rows.map((row) => ({
        id: row.id,
        fromNodeId: row.from_node_id,
        toNodeId: row.to_node_id,
        surfaceType: row.surface_type,
        widthMeters: row.width_meters === null ? null : Number(row.width_meters),
        slopePercent: row.slope_percent === null ? null : Number(row.slope_percent),
        stairs: row.stairs,
        stepFree: row.step_free,
        lastObservedAt: row.last_observed_at,
        status: row.status
      }))
    };
  }

  async getProfile(userId) {
    const result = await withDatabase(this.pool, (client) => client.query(
      `SELECT user_id, requirements, profile_version, created_at, updated_at
         FROM user_access_profiles
        WHERE user_id = $1`,
      [userId]
    ));
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      userId: row.user_id,
      requirements: row.requirements,
      version: row.profile_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async upsertProfile(userId, requirements) {
    const result = await withTransaction(this.pool, async (client) => {
      const saved = await client.query(
        `INSERT INTO user_access_profiles (user_id, requirements, profile_version)
         VALUES ($1, $2::jsonb, 1)
         ON CONFLICT (user_id) DO UPDATE
           SET requirements = EXCLUDED.requirements,
               profile_version = user_access_profiles.profile_version + 1
         RETURNING user_id, requirements, profile_version, created_at, updated_at`,
        [userId, JSON.stringify(requirements)]
      );
      return saved.rows[0];
    });
    return {
      userId: result.user_id,
      requirements: result.requirements,
      version: result.profile_version,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }

  async claimsForMatch(placeId) {
    const claims = await this.listClaims(placeId);
    return {
      claimsVersion: claims.reduce((version, claim) => Math.max(version, claim.claimsVersion), 0),
      claims
    };
  }
}

export function makeId() {
  return randomUUID();
}
