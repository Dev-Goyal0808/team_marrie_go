const SOURCE_LABELS = {
  community: 'community_observation',
  facility: 'facility_response',
  admin: 'administrative_source',
  import: 'imported_source'
};

function optionalNumber(value) {
  return value === null || value === undefined ? undefined : Number(value);
}

export function serializePlaceSummary(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category ?? row.categoryCode,
    address: row.address,
    ...(row.distanceMeters === null || row.distanceMeters === undefined ? {} : { distanceMeters: Number(row.distanceMeters) }),
    sampleData: Boolean(row.sampleData ?? row.isSample)
  };
}

export function serializePlaceResult(row) {
  return {
    ...serializePlaceSummary(row),
    categoryName: row.categoryName ?? row.category_name ?? row.category,
    city: row.city,
    status: row.status,
    source: row.source,
    latitude: optionalNumber(row.latitude),
    longitude: optionalNumber(row.longitude),
    description: row.description ?? null,
    latestObservedAt: row.latestObservedAt ?? row.latest_observed_at ?? null,
    activeIncidentCount: Number(row.activeIncidentCount ?? row.active_incident_count ?? 0)
  };
}

export function serializePlaceDetail(row, { claims = [], incidents = [] } = {}) {
  return {
    ...serializePlaceResult(row),
    postalCode: row.postalCode ?? row.postal_code ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    openingHours: row.openingHours ?? row.opening_hours ?? null,
    claims,
    incidents,
    matchReady: {
      claimsVersion: claims.reduce((version, claim) => Math.max(version, Number(claim.claimsVersion ?? 0)), 0),
      featureCodes: claims.map((claim) => claim.featureCode)
    }
  };
}

export function serializeClaim(row) {
  return {
    featureCode: row.featureCode ?? row.feature_code,
    status: row.status,
    source: row.source ?? 'unknown',
    observedAt: row.observedAt ?? row.latestObservedAt ?? row.latest_observed_at ?? null,
    supportingCount: Number(row.supportingCount ?? row.supporting_count ?? 0),
    disputingCount: Number(row.disputingCount ?? row.disputing_count ?? 0),
    summaryValue: row.summaryValue ?? row.summary_value ?? 'unknown',
    freshnessState: row.freshnessState ?? row.freshness_state ?? 'needs_reverification',
    claimsVersion: Number(row.claimsVersion ?? row.claims_version ?? 0),
    calculationVersion: Number(row.calculationVersion ?? row.calculation_version ?? 1),
    label: row.label ?? null,
    description: row.description ?? null
  };
}

export function serializeIncident(row) {
  return {
    id: String(row.id),
    placeId: String(row.placeId ?? row.place_id),
    type: row.type ?? row.incident_type,
    severity: row.severity,
    status: row.status,
    startsAt: row.startsAt ?? row.starts_at,
    reviewAt: row.reviewAt ?? row.review_at,
    ...(row.resolvedAt || row.resolved_at ? { resolvedAt: row.resolvedAt ?? row.resolved_at } : {}),
    ...(row.description ? { description: row.description } : {}),
    sampleData: Boolean(row.sampleData ?? row.isSample)
  };
}

export function serializeCategory(row) {
  return { code: row.code, name: row.name, sampleData: Boolean(row.sampleData ?? row.isSample) };
}

export function serializeFeature(row) {
  return {
    code: row.code,
    category: row.category,
    label: row.label,
    description: row.description ?? null,
    inputType: row.inputType ?? row.input_type,
    freshnessDays: Number(row.freshnessDays ?? row.freshness_days),
    sampleData: Boolean(row.sampleData ?? row.isSample)
  };
}

export function sourceLabel(sourceType) {
  return SOURCE_LABELS[sourceType] ?? sourceType ?? 'unknown';
}
