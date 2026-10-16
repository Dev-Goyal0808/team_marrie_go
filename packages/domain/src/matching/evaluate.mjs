import { MATCH_DECISIONS } from '../index.mjs';
import { classifyClaim } from './claims.mjs';
import { normalizeProfile } from './profile.mjs';

export const MATCH_CALCULATION_VERSION = 1;

function emptyTotals() {
  return { total: 0, confirmed: 0, knownBarriers: 0, unknown: 0 };
}

function itemFromClassification(requirement, classification, result = classification.result) {
  return {
    featureCode: requirement.featureCode,
    level: requirement.level,
    result,
    reason: classification.reason,
    claimStatus: classification.claimStatus,
    source: classification.source,
    observedAt: classification.observedAt,
    supportingCount: classification.supportingCount,
    disputingCount: classification.disputingCount
  };
}

export function evaluateMatch(profile, claims = [], { claimsVersion = 0, calculationVersion = MATCH_CALCULATION_VERSION } = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const claimsByFeature = new Map(claims.map((claim) => [claim.featureCode, claim]));
  const required = emptyTotals();
  const preferred = emptyTotals();
  const items = [];
  const avoidanceWarnings = [];

  for (const requirement of normalizedProfile.requirements) {
    const classification = classifyClaim(claimsByFeature.get(requirement.featureCode));

    if (requirement.level === 'avoid') {
      const avoidClaim = claimsByFeature.get(requirement.featureCode);
      const avoidValue = avoidClaim?.summaryValue ?? avoidClaim?.summary_value;
      const avoidResult = classification.result === 'confirmed' && avoidValue === 'yes'
        ? 'avoidance_warning'
        : classification.result;
      const item = itemFromClassification(requirement, classification, avoidResult);
      items.push(item);
      if (avoidResult === 'avoidance_warning') avoidanceWarnings.push({ ...item, reason: 'A known condition conflicts with an avoid preference.' });
      continue;
    }

    const totals = requirement.level === 'required' ? required : preferred;
    totals.total += 1;
    if (classification.result === 'confirmed') totals.confirmed += 1;
    else if (classification.result === 'barrier') totals.knownBarriers += 1;
    else totals.unknown += 1;
    items.push(itemFromClassification(requirement, classification));
  }

  let decision = MATCH_DECISIONS.includes('no_profile') && normalizedProfile.requirements.length === 0
    ? 'no_profile'
    : 'meets_known_requirements';

  if (required.knownBarriers > 0) decision = 'known_barrier';
  else if (required.unknown > 0) decision = 'needs_more_information';

  return {
    decision,
    required,
    preferred,
    avoidanceWarnings,
    items: items.sort((left, right) => left.featureCode.localeCompare(right.featureCode)),
    claimsVersion,
    calculationVersion
  };
}
