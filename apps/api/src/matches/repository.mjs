import { evaluateMatch, normalizeProfile, profileHash } from '../../../../packages/domain/src/matching/index.mjs';
import { readJsonCache, writeJsonCache } from '../places/cache.mjs';

const DEFAULT_CACHE_TTL_SECONDS = 30;
const PUBLIC_PLACE_STATUSES = ['active', 'temporarily_closed'];

function publicSourceSql() {
  return `CASE
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
  END`;
}

function normalizeClaimRow(row) {
  return {
    featureCode: row.feature_code,
    status: row.status,
    summaryValue: row.summary_value,
    freshnessState: row.freshness_state,
    latestObservedAt: row.latest_observed_at,
    supportingCount: Number(row.supporting_count ?? 0),
    disputingCount: Number(row.disputing_count ?? 0),
    calculationVersion: Number(row.calculation_version ?? 1),
    claimsVersion: Number(row.claims_version ?? 0),
    source: row.source
  };
}

export function createMatchRepository({ db, cache, cacheTtlSeconds = DEFAULT_CACHE_TTL_SECONDS } = {}) {
  if (!db?.query) throw new TypeError('A database adapter with query(text, values) is required.');

  async function activeFeatureCodes() {
    const result = await db.query(`SELECT code FROM accessibility_features WHERE is_active = true ORDER BY code`);
    return new Set(result.rows.map((row) => row.code));
  }

  async function getProfile(userId) {
    const result = await db.query(`
      SELECT requirements, profile_version
        FROM user_access_profiles
       WHERE user_id = $1
    `, [userId]);
    if (result.rows.length === 0) return { requirements: [], profileVersion: 0 };
    return {
      requirements: Array.isArray(result.rows[0].requirements) ? result.rows[0].requirements : [],
      profileVersion: Number(result.rows[0].profile_version)
    };
  }

  async function saveProfile(userId, profile) {
    const activeCodes = await activeFeatureCodes();
    const normalized = normalizeProfile(profile, { activeFeatureCodes: activeCodes });
    const result = await db.query(`
      INSERT INTO user_access_profiles (user_id, requirements, profile_version)
      VALUES ($1, $2::jsonb, 1)
      ON CONFLICT (user_id) DO UPDATE
        SET requirements = EXCLUDED.requirements,
            profile_version = user_access_profiles.profile_version + 1,
            updated_at = now()
      RETURNING requirements, profile_version
    `, [userId, JSON.stringify(normalized.requirements)]);
    return {
      requirements: result.rows[0].requirements,
      profileVersion: Number(result.rows[0].profile_version)
    };
  }

  async function getPlaceClaims(placeId) {
    const placeResult = await db.query(`
      SELECT id
        FROM places
       WHERE id = $1
         AND status = ANY($2::text[])
    `, [placeId, PUBLIC_PLACE_STATUSES]);
    if (placeResult.rows.length === 0) return null;

    const result = await db.query(`
      SELECT c.id,
             af.code AS feature_code,
             c.status,
             c.summary_value,
             c.freshness_state,
             c.latest_observed_at,
             c.supporting_count,
             c.disputing_count,
             c.calculation_version,
             c.claims_version,
             ${publicSourceSql()} AS source
        FROM claims c
        JOIN accessibility_features af ON af.id = c.feature_id AND af.is_active = true
       WHERE c.place_id = $1
       ORDER BY af.code
    `, [placeId]);

    return {
      claims: result.rows.map(normalizeClaimRow),
      claimsVersion: result.rows.reduce((version, row) => Math.max(version, Number(row.claims_version ?? 0)), 0)
    };
  }

  async function getMatchForProfile(placeId, profile, { useCache = true } = {}) {
    const snapshot = await getPlaceClaims(placeId);
    if (!snapshot) return null;
    const normalized = normalizeProfile(profile);
    const hash = profileHash(normalized);
    const cacheKey = `accessmap:match:${placeId}:${snapshot.claimsVersion}:${hash}`;

    if (useCache) {
      const cached = await readJsonCache(cache, cacheKey);
      if (cached) return { explanation: cached, cache: 'hit', claimsVersion: snapshot.claimsVersion };
    }

    const explanation = evaluateMatch(normalized, snapshot.claims, { claimsVersion: snapshot.claimsVersion });
    if (useCache) await writeJsonCache(cache, cacheKey, explanation, cacheTtlSeconds);
    return { explanation, cache: 'miss', claimsVersion: snapshot.claimsVersion };
  }

  async function getAuthenticatedMatch(userId, placeId) {
    const profile = await getProfile(userId);
    const activeCodes = await activeFeatureCodes();
    const normalized = normalizeProfile(profile, { activeFeatureCodes: activeCodes });
    return getMatchForProfile(placeId, normalized, { useCache: true });
  }

  async function compareAnonymous(profile, placeIds) {
    const activeCodes = await activeFeatureCodes();
    const normalized = normalizeProfile(profile, { activeFeatureCodes: activeCodes });
    const items = [];
    for (const placeId of placeIds) {
      const match = await getMatchForProfile(placeId, normalized, { useCache: false });
      if (match) items.push({ placeId, explanation: match.explanation });
    }
    return items;
  }

  return Object.freeze({
    activeFeatureCodes,
    compareAnonymous,
    getAuthenticatedMatch,
    getPlaceClaims,
    getProfile,
    saveProfile
  });
}
