import { createProblem } from '../../../../packages/validation/src/index.mjs';
import { ProfileValidationError } from '../../../../packages/domain/src/matching/index.mjs';
import { serializeAnonymousMatches, serializeMatchResponse, serializePrivateProfile } from './serializers.mjs';
import { MatchInputError, placeIdsFromBody, problemDetailForMatchInput, profileFromBody } from './validation.mjs';
import { PlaceInputError, validatePlaceId } from '../places/validation.mjs';

function result(status, payload, headers = {}) {
  return { status, payload, headers };
}

function problem(status, title, detail, traceId) {
  const typeName = status === 400 ? 'invalid-request' : status === 401 ? 'unauthorized' : status === 404 ? 'not-found' : status === 405 ? 'method-not-allowed' : 'service-unavailable';
  return result(status, createProblem({
    status,
    title,
    detail,
    traceId,
    type: `https://accessmap.example/problems/${typeName}`
  }));
}

function requireUser(context) {
  if (!context?.auth?.authenticated || !context.auth.userId) return null;
  return context.auth.userId;
}

function privateHeaders() {
  return { 'Cache-Control': 'no-store', Vary: 'Cookie, Authorization' };
}

function publicHeaders(cache) {
  return {
    'Cache-Control': 'private, no-store',
    ...(cache ? { 'X-AccessMap-Cache': cache } : {})
  };
}

export function createMatchHandlers({ repository } = {}) {
  if (!repository) throw new TypeError('A match repository is required.');

  async function getProfile(context = {}) {
    const userId = requireUser(context);
    if (!userId) return problem(401, 'Authentication required', 'Sign in to manage your private access profile.', context.traceId);
    try {
      return result(200, serializePrivateProfile(await repository.getProfile(userId)), privateHeaders());
    } catch {
      return problem(503, 'Profile unavailable', 'Your private access profile is temporarily unavailable.', context.traceId);
    }
  }

  async function patchProfile(context = {}) {
    const userId = requireUser(context);
    if (!userId) return problem(401, 'Authentication required', 'Sign in to manage your private access profile.', context.traceId);
    try {
      const profile = profileFromBody(context.body);
      const saved = await repository.saveProfile(userId, profile);
      return result(200, serializePrivateProfile(saved), privateHeaders());
    } catch (error) {
      if (error instanceof MatchInputError || error instanceof ProfileValidationError) return problem(400, 'Invalid access profile', problemDetailForMatchInput(error), context.traceId);
      return problem(503, 'Profile unavailable', 'Your private access profile could not be saved. Please try again.', context.traceId);
    }
  }

  async function getPlaceMatch(context = {}) {
    const userId = requireUser(context);
    if (!userId) return problem(401, 'Authentication required', 'Sign in to compare a place with your private profile.', context.traceId);
    let placeId;
    try {
      placeId = validatePlaceId(context.params?.placeId);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place ID', problemDetailForMatchInput(error), context.traceId);
      return problem(400, 'Invalid place ID', 'Place ID is invalid.', context.traceId);
    }
    try {
      const match = await repository.getAuthenticatedMatch(userId, placeId);
      if (!match) return problem(404, 'Place not found', 'The requested place is not available.', context.traceId);
      return result(200, serializeMatchResponse(placeId, match), publicHeaders(match.cache));
    } catch {
      return problem(503, 'Match unavailable', 'This place cannot be compared right now. Please try again.', context.traceId);
    }
  }

  async function comparePlaces(context = {}) {
    try {
      const profile = profileFromBody(context.body);
      const placeIds = placeIdsFromBody(context.body);
      const items = await repository.compareAnonymous(profile, placeIds);
      return result(200, serializeAnonymousMatches(items), { 'Cache-Control': 'no-store' });
    } catch (error) {
      if (error instanceof MatchInputError || error instanceof ProfileValidationError) return problem(400, 'Invalid match request', problemDetailForMatchInput(error), context.traceId);
      return problem(503, 'Match unavailable', 'Places cannot be compared right now. Please try again.', context.traceId);
    }
  }

  return Object.freeze({ comparePlaces, getPlaceMatch, getProfile, patchProfile });
}

export function createMatchRequestHandler({ repository } = {}) {
  const handlers = createMatchHandlers({ repository });
  return async function handleMatchRequest({ method = 'GET', pathname, params = {}, query, body, auth, traceId } = {}) {
    const placeMatch = String(pathname ?? '').match(/^\/api\/places\/([^/]+)\/match$/);
    const resolvedParams = placeMatch ? { ...params, placeId: params.placeId ?? decodeURIComponent(placeMatch[1]) } : params;
    const context = { params: resolvedParams, query, body, auth, traceId };
    if (method === 'GET' && pathname === '/api/me/access-match-profile') return handlers.getProfile(context);
    if (method === 'PATCH' && pathname === '/api/me/access-match-profile') return handlers.patchProfile(context);
    if (method === 'GET' && placeMatch) return handlers.getPlaceMatch(context);
    if (method === 'POST' && pathname === '/api/matches/places') return handlers.comparePlaces(context);
    return problem(method === 'GET' || method === 'PATCH' || method === 'POST' ? 404 : 405, 'Resource not found', 'The requested match resource does not exist.', traceId);
  };
}
