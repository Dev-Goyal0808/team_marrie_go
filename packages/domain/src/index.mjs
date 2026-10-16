export const USER_ROLES = Object.freeze([
  'user',
  'moderator',
  'admin',
  'facility_manager'
]);

export const REQUIREMENT_LEVELS = Object.freeze([
  'required',
  'preferred',
  'avoid'
]);

export const MATCH_DECISIONS = Object.freeze([
  'meets_known_requirements',
  'partial',
  'needs_more_information',
  'known_barrier',
  'no_profile'
]);

export const OBSERVATION_VALUES = Object.freeze([
  'yes',
  'no',
  'partial',
  'temporarily_unavailable',
  'unknown'
]);

export const OBSERVATION_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'changes_requested',
  'synced'
]);

export const INCIDENT_STATUSES = Object.freeze([
  'reported',
  'validated',
  'published',
  'disputed',
  'resolved',
  'archived'
]);

export function isOneOf(value, allowedValues) {
  return allowedValues.includes(value);
}
