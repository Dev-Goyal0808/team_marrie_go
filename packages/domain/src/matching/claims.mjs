const POSITIVE_STATUSES = new Set([
  'community_reported',
  'recently_observed',
  'community_corroborated',
  'facility_confirmed',
  'resolved'
]);

const UNKNOWN_STATUSES = new Set([
  'not_assessed',
  'conflicting_information',
  'needs_reverification'
]);

export function classifyClaim(claim) {
  if (!claim) {
    return {
      result: 'unknown',
      reason: 'No current claim is available.',
      claimStatus: 'not_assessed'
    };
  }

  const status = claim.status ?? 'not_assessed';
  const summaryValue = claim.summaryValue ?? claim.summary_value ?? 'unknown';
  const freshnessState = claim.freshnessState ?? claim.freshness_state ?? 'needs_reverification';
  const observedAt = claim.observedAt ?? claim.latestObservedAt ?? claim.latest_observed_at ?? null;
  const source = claim.source ?? claim.sourceType ?? claim.source_type ?? 'unknown';

  const base = {
    claimStatus: status,
    freshnessState,
    source,
    observedAt,
    supportingCount: claim.supportingCount ?? claim.supporting_count ?? 0,
    disputingCount: claim.disputingCount ?? claim.disputing_count ?? 0
  };

  if (UNKNOWN_STATUSES.has(status) || freshnessState !== 'fresh' || summaryValue === 'unknown' || summaryValue === 'partial') {
    return {
      ...base,
      result: 'unknown',
      reason: freshnessState === 'stale' || freshnessState === 'needs_reverification'
        ? 'The supporting information may no longer be current.'
        : status === 'conflicting_information'
          ? 'Recent observations disagree about this feature.'
          : 'There is not enough current information to confirm this feature.'
    };
  }

  if (summaryValue === 'no' || summaryValue === 'temporarily_unavailable' || status === 'temporarily_unavailable') {
    return {
      ...base,
      result: 'barrier',
      reason: summaryValue === 'temporarily_unavailable' || status === 'temporarily_unavailable'
        ? 'The feature is currently reported as temporarily unavailable.'
        : 'A current claim reports that this feature is unavailable.'
    };
  }

  if (summaryValue === 'yes' && POSITIVE_STATUSES.has(status)) {
    return {
      ...base,
      result: 'confirmed',
      reason: 'A recent supporting claim confirms this feature.'
    };
  }

  return {
    ...base,
    result: 'unknown',
    reason: 'The current claim cannot be safely classified as confirmed.'
  };
}
