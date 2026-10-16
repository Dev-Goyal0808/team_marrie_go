import { boundedCacheKey, readJsonCache, writeJsonCache } from './cache.mjs';
import {
  serializeCategory,
  serializeClaim,
  serializeFeature,
  serializeIncident,
  serializePlaceDetail,
  serializePlaceResult
} from './serializers.mjs';

const PUBLIC_PLACE_STATUSES = ['active', 'temporarily_closed'];
const PUBLIC_INCIDENT_STATUSES = ['published', 'resolved', 'archived'];
const DEFAULT_CACHE_TTL_SECONDS = 30;

function placeholder(values, value) {
  values.push(value);
  return `$${values.length}`;
}

function buildSearchStatement(params) {
  const values = [];
  const where = [
    `p.status = ANY(${placeholder(values, PUBLIC_PLACE_STATUSES)}::text[])`,
    'pc.is_active = true'
  ];
  const coordinateExpression = params.latitude === undefined
    ? null
    : `ST_SetSRID(ST_Point(${placeholder(values, params.longitude)}, ${placeholder(values, params.latitude)}), 4326)::geography`;

  if (params.query) {
    const pattern = `%${params.query}%`;
    const value = placeholder(values, pattern);
    where.push(`(p.name ILIKE ${value} OR p.address ILIKE ${value} OR p.city ILIKE ${value})`);
  }
  if (params.city) where.push(`p.city ILIKE ${placeholder(values, params.city)}`);
  if (params.category) where.push(`pc.code = ${placeholder(values, params.category)}`);
  if (coordinateExpression) {
    where.push(`ST_DWithin(p.geom, ${coordinateExpression}, ${placeholder(values, params.radiusMeters)})`);
  }
  if (params.bbox) {
    const bboxExpression = `ST_SetSRID(ST_MakeEnvelope(${placeholder(values, params.bbox.west)}, ${placeholder(values, params.bbox.south)}, ${placeholder(values, params.bbox.east)}, ${placeholder(values, params.bbox.north)}), 4326)::geography`;
    where.push(`ST_Intersects(p.geom, ${bboxExpression})`);
  }
  for (const featureCode of params.features) {
    const featurePlaceholder = placeholder(values, featureCode);
    where.push(`EXISTS (
      SELECT 1
        FROM claims filtered_claim
        JOIN accessibility_features filtered_feature ON filtered_feature.id = filtered_claim.feature_id
       WHERE filtered_claim.place_id = p.id
         AND filtered_feature.code = ${featurePlaceholder}
         AND filtered_feature.is_active = true
         AND filtered_claim.summary_value = 'yes'
         AND filtered_claim.freshness_state = 'fresh'
         AND filtered_claim.status NOT IN ('not_assessed', 'needs_reverification', 'conflicting_information', 'temporarily_unavailable')
    )`);
  }

  const distanceSelect = coordinateExpression ? `ST_Distance(p.geom, ${coordinateExpression})` : 'NULL::double precision';
  const orderBy = {
    distance: 'distance_meters ASC NULLS LAST, p.name ASC, p.id ASC',
    freshness: 'freshness.latest_observed_at DESC NULLS LAST, p.name ASC, p.id ASC',
    name: 'p.name ASC, p.id ASC',
    relevance: 'p.name ASC, p.id ASC'
  }[params.sort];
  const limitPlaceholder = placeholder(values, params.pageSize);
  const offsetPlaceholder = placeholder(values, (params.page - 1) * params.pageSize);

  return {
    text: `
      SELECT
        p.id,
        p.name,
        p.address,
        p.city,
        p.latitude,
        p.longitude,
        p.description,
        p.phone,
        p.website,
        p.opening_hours,
        p.source,
        p.status,
        p.is_sample,
        pc.code AS category,
        pc.name AS category_name,
        ${distanceSelect} AS distance_meters,
        freshness.latest_observed_at,
        (
          SELECT COUNT(*)
            FROM barrier_events active_incident
           WHERE active_incident.place_id = p.id
             AND active_incident.status IN ('reported', 'validated', 'published', 'disputed')
        ) AS active_incident_count,
        COUNT(*) OVER ()::integer AS total_count
      FROM places p
      JOIN place_categories pc ON pc.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT MAX(current_claim.latest_observed_at) AS latest_observed_at
          FROM claims current_claim
         WHERE current_claim.place_id = p.id
      ) freshness ON true
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `,
    values
  };
}

function normalizeRows(rows) {
  return rows.map((row) => serializePlaceResult({
    ...row,
    distanceMeters: row.distance_meters,
    categoryName: row.category_name,
    latestObservedAt: row.latest_observed_at,
    activeIncidentCount: row.active_incident_count,
    sampleData: row.is_sample
  }));
}

export function createPlaceRepository({ db, cache, cacheTtlSeconds = DEFAULT_CACHE_TTL_SECONDS } = {}) {
  if (!db?.query) throw new TypeError('A database adapter with query(text, values) is required.');

  async function searchPlaces(params) {
    const key = boundedCacheKey('search', params);
    const cached = await readJsonCache(cache, key);
    if (cached) return { ...cached, cache: 'hit' };

    const statement = buildSearchStatement(params);
    const result = await db.query(statement.text, statement.values);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const response = {
      items: normalizeRows(result.rows),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        hasNext: params.page * params.pageSize < total
      }
    };
    await writeJsonCache(cache, key, response, cacheTtlSeconds);
    return { ...response, cache: 'miss' };
  }

  async function getPlace(placeId) {
    const result = await db.query(`
      SELECT p.id, p.name, p.description, p.address, p.city, p.postal_code,
             p.latitude, p.longitude, p.phone, p.website, p.opening_hours,
             p.source, p.status, p.is_sample,
             pc.code AS category, pc.name AS category_name
        FROM places p
        JOIN place_categories pc ON pc.id = p.category_id AND pc.is_active = true
       WHERE p.id = $1
         AND p.status = ANY($2::text[])
    `, [placeId, PUBLIC_PLACE_STATUSES]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  async function listClaims(placeId) {
    const result = await db.query(`
      SELECT c.id,
             af.code AS feature_code,
             af.label,
             af.description,
             c.status,
             c.summary_value,
             c.latest_observed_at,
             c.freshness_state,
             c.supporting_count,
             c.disputing_count,
             c.calculation_version,
             c.claims_version,
             CASE
               WHEN c.status = 'facility_confirmed' THEN 'facility_response'
               ELSE COALESCE((
                 SELECT CASE latest_observation.source_type
                   WHEN 'community' THEN 'community_observation'
                   WHEN 'facility' THEN 'facility_response'
                   WHEN 'admin' THEN 'administrative_source'
                   WHEN 'import' THEN 'imported_source'
                   ELSE latest_observation.source_type
                 END
                   FROM observations latest_observation
                  WHERE latest_observation.place_id = c.place_id
                    AND latest_observation.feature_id = c.feature_id
                    AND latest_observation.visibility = 'public'
                    AND latest_observation.moderation_status = 'approved'
                  ORDER BY latest_observation.observed_at DESC
                  LIMIT 1
               ), 'unknown')
             END AS source
        FROM claims c
        JOIN accessibility_features af ON af.id = c.feature_id AND af.is_active = true
       WHERE c.place_id = $1
       ORDER BY af.category, af.label, af.code
    `, [placeId]);
    return result.rows.map((row) => serializeClaim({ ...row, featureCode: row.feature_code }));
  }

  async function listIncidents(placeId, { includeHistory = false } = {}) {
    const statuses = includeHistory ? PUBLIC_INCIDENT_STATUSES : ['published'];
    const result = await db.query(`
      SELECT id, place_id, incident_type, severity, status, description,
             starts_at, review_at, resolved_at, is_sample
        FROM barrier_events
       WHERE place_id = $1
         AND status = ANY($2::text[])
       ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                starts_at DESC, id
    `, [placeId, statuses]);
    return result.rows.map((row) => serializeIncident({ ...row, placeId: row.place_id, type: row.incident_type, startsAt: row.starts_at, reviewAt: row.review_at, resolvedAt: row.resolved_at, sampleData: row.is_sample }));
  }

  async function getAccessGraph(placeId) {
    const nodes = await db.query(`
      SELECT id, place_id, node_type, label, floor, status, is_sample,
             ST_AsGeoJSON(geom)::json AS geometry
        FROM access_nodes
       WHERE place_id = $1
         AND status IN ('active', 'unknown')
       ORDER BY label, id
    `, [placeId]);
    const edges = await db.query(`
      SELECT e.id, e.from_node_id, e.to_node_id, e.surface_type,
             e.width_meters, e.slope_percent, e.stairs, e.step_free,
             e.last_observed_at, e.status, e.is_sample,
             ST_AsGeoJSON(e.geometry)::json AS geometry
        FROM access_edges e
        JOIN access_nodes from_node ON from_node.id = e.from_node_id AND from_node.place_id = $1
        JOIN access_nodes to_node ON to_node.id = e.to_node_id AND to_node.place_id = $1
       WHERE e.status IN ('active', 'unknown')
       ORDER BY e.id
    `, [placeId]);
    return {
      nodes: nodes.rows.map((node) => ({ id: node.id, placeId: node.place_id, type: node.node_type, label: node.label, floor: node.floor, status: node.status, geometry: node.geometry, sampleData: Boolean(node.is_sample) })),
      edges: edges.rows.map((edge) => ({ id: edge.id, fromNodeId: edge.from_node_id, toNodeId: edge.to_node_id, surfaceType: edge.surface_type, widthMeters: edge.width_meters === null ? null : Number(edge.width_meters), slopePercent: edge.slope_percent === null ? null : Number(edge.slope_percent), stairs: edge.stairs, stepFree: edge.step_free, lastObservedAt: edge.last_observed_at, status: edge.status, geometry: edge.geometry, sampleData: Boolean(edge.is_sample) }))
    };
  }

  async function getPlaceDetail(placeId) {
    const place = await getPlace(placeId);
    if (!place) return null;
    const [claims, incidents] = await Promise.all([listClaims(placeId), listIncidents(placeId)]);
    return serializePlaceDetail({ ...place, categoryName: place.category_name, sampleData: place.is_sample }, { claims, incidents });
  }

  async function listCategories() {
    const result = await db.query(`SELECT code, name, is_sample FROM place_categories WHERE is_active = true ORDER BY name, code`);
    return result.rows.map(serializeCategory);
  }

  async function listFeatures() {
    const result = await db.query(`
      SELECT code, category, label, description, input_type, freshness_days, is_sample
        FROM accessibility_features
       WHERE is_active = true
       ORDER BY category, label, code
    `);
    return result.rows.map(serializeFeature);
  }

  async function activeCodeSets() {
    const [categories, features] = await Promise.all([listCategories(), listFeatures()]);
    return {
      categoryCodes: new Set(categories.map((category) => category.code)),
      featureCodes: new Set(features.map((feature) => feature.code))
    };
  }

  return Object.freeze({
    activeCodeSets,
    getAccessGraph,
    getPlace,
    getPlaceDetail,
    listCategories,
    listClaims,
    listFeatures,
    listIncidents,
    searchPlaces
  });
}
