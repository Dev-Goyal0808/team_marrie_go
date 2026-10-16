import { ProfileValidationError, normalizeProfile } from '../../../../packages/domain/src/matching/index.mjs';
import { validatePlaceId } from '../places/validation.mjs';

const MAX_ANONYMOUS_PLACES = 50;

export class MatchInputError extends Error {
  constructor(errors) {
    super('Accessibility Match request is invalid.');
    this.name = 'MatchInputError';
    this.errors = errors;
  }
}

export function profileFromBody(body) {
  const profile = body?.profile ?? body;
  try {
    return normalizeProfile(profile);
  } catch (error) {
    if (error instanceof ProfileValidationError) throw new MatchInputError(error.errors);
    throw error;
  }
}

export function placeIdsFromBody(body) {
  const values = body?.placeIds ?? (body?.placeId ? [body.placeId] : []);
  if (!Array.isArray(values) || values.length === 0) throw new MatchInputError([{ field: 'placeId', message: 'At least one place ID is required.' }]);
  if (values.length > MAX_ANONYMOUS_PLACES) throw new MatchInputError([{ field: 'placeIds', message: `No more than ${MAX_ANONYMOUS_PLACES} places can be compared at once.` }]);
  const unique = [...new Set(values)];
  try {
    unique.forEach(validatePlaceId);
  } catch (error) {
    if (error.errors) throw new MatchInputError(error.errors);
    throw error;
  }
  return unique;
}

export function problemDetailForMatchInput(error) {
  return error.errors.map(({ field, message }) => `${field}: ${message}`).join(' ');
}
