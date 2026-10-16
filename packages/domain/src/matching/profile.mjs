import { createHash } from 'node:crypto';
import { REQUIREMENT_LEVELS } from '../index.mjs';

const FEATURE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class ProfileValidationError extends Error {
  constructor(errors) {
    super('Accessibility Match Profile is invalid.');
    this.name = 'ProfileValidationError';
    this.errors = errors;
  }
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

export function validateProfile(profile, { activeFeatureCodes } = {}) {
  const errors = [];
  const requirements = profile?.requirements;

  if (!Array.isArray(requirements)) {
    addError(errors, 'requirements', 'Requirements must be an array.');
    return { valid: false, errors };
  }

  const activeCodes = activeFeatureCodes ? new Set(activeFeatureCodes) : null;
  const seenCodes = new Set();

  requirements.forEach((requirement, index) => {
    const field = `requirements[${index}]`;
    const featureCode = requirement?.featureCode;
    const level = requirement?.level;

    if (typeof featureCode !== 'string' || !FEATURE_CODE_PATTERN.test(featureCode)) {
      addError(errors, `${field}.featureCode`, 'Feature code must use lowercase letters, numbers, and underscores.');
    } else if (seenCodes.has(featureCode)) {
      addError(errors, `${field}.featureCode`, 'A feature can appear only once in a profile.');
    } else {
      seenCodes.add(featureCode);
      if (activeCodes && !activeCodes.has(featureCode)) {
        addError(errors, `${field}.featureCode`, 'This feature is not currently available.');
      }
    }

    if (!REQUIREMENT_LEVELS.includes(level)) {
      addError(errors, `${field}.level`, 'Requirement level must be required, preferred, or avoid.');
    }
  });

  return { valid: errors.length === 0, errors };
}

export function normalizeProfile(profile, options = {}) {
  const result = validateProfile(profile, options);
  if (!result.valid) throw new ProfileValidationError(result.errors);

  return {
    requirements: profile.requirements
      .map(({ featureCode, level }) => ({ featureCode, level }))
      .sort((left, right) => left.featureCode.localeCompare(right.featureCode))
  };
}

export function canonicalProfile(profile, options = {}) {
  return JSON.stringify(normalizeProfile(profile, options));
}

export function profileHash(profile, options = {}) {
  return createHash('sha256').update(canonicalProfile(profile, options)).digest('hex');
}
