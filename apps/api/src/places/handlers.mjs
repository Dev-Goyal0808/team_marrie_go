import { createProblem } from '../../../../packages/validation/src/index.mjs';
import { boundedCacheKey } from './cache.mjs';
import { PlaceInputError, parsePlaceQuery, problemDetailForInput, validatePlaceId } from './validation.mjs';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
  Vary: 'Accept-Encoding'
};

function result(status, payload, headers = {}) {
  return { status, payload, headers };
}

function problem(status, title, detail, traceId) {
  const typeName = status === 400 ? 'invalid-request' : status === 404 ? 'not-found' : status === 405 ? 'method-not-allowed' : 'service-unavailable';
  return result(status, createProblem({
    status,
    title,
    detail,
    traceId,
    type: `https://accessmap.example/problems/${typeName}`
  }));
}

function collection(items, page = 1, pageSize = items.length || 20) {
  return { items, pagination: { page, pageSize, total: items.length, hasNext: false } };
}

function routeContext(context = {}) {
  return {
    params: context.params ?? {},
    query: context.query ?? context.searchParams ?? new URLSearchParams(),
    traceId: context.traceId
  };
}

export function createPlaceHandlers({ repository } = {}) {
  if (!repository) throw new TypeError('A place repository is required.');

  async function search(context = {}) {
    try {
      const request = routeContext(context);
      const codes = await repository.activeCodeSets();
      const query = parsePlaceQuery(request.query, codes);
      const response = await repository.searchPlaces(query);
      const headers = { ...PUBLIC_CACHE_HEADERS };
      if (response.cache) headers['X-AccessMap-Cache'] = response.cache;
      const payload = { ...response };
      delete payload.cache;
      return result(200, payload, headers);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place search', problemDetailForInput(error), context.traceId);
      return problem(503, 'Place search unavailable', 'Place search is temporarily unavailable. Please try again.', context.traceId);
    }
  }

  async function getPlace(context = {}) {
    try {
      const request = routeContext(context);
      const placeId = validatePlaceId(request.params.placeId);
      const payload = await repository.getPlaceDetail(placeId);
      if (!payload) return problem(404, 'Place not found', 'The requested place is not available.', request.traceId);
      return result(200, payload, PUBLIC_CACHE_HEADERS);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place ID', problemDetailForInput(error), context.traceId);
      return problem(503, 'Place detail unavailable', 'Place details are temporarily unavailable. Please try again.', context.traceId);
    }
  }

  async function claims(context = {}) {
    try {
      const request = routeContext(context);
      const placeId = validatePlaceId(request.params.placeId);
      const place = await repository.getPlace(placeId);
      if (!place) return problem(404, 'Place not found', 'The requested place is not available.', request.traceId);
      const items = await repository.listClaims(placeId);
      return result(200, collection(items), PUBLIC_CACHE_HEADERS);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place ID', problemDetailForInput(error), context.traceId);
      return problem(503, 'Claims unavailable', 'Accessibility claims are temporarily unavailable. Please try again.', context.traceId);
    }
  }

  async function incidents(context = {}) {
    try {
      const request = routeContext(context);
      const placeId = validatePlaceId(request.params.placeId);
      const place = await repository.getPlace(placeId);
      if (!place) return problem(404, 'Place not found', 'The requested place is not available.', request.traceId);
      const includeHistory = request.query?.get?.('history') === 'true' || request.query?.history === 'true';
      const items = await repository.listIncidents(placeId, { includeHistory });
      return result(200, collection(items), PUBLIC_CACHE_HEADERS);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place ID', problemDetailForInput(error), context.traceId);
      return problem(503, 'Incidents unavailable', 'Accessibility incidents are temporarily unavailable. Please try again.', context.traceId);
    }
  }

  async function accessGraph(context = {}) {
    try {
      const request = routeContext(context);
      const placeId = validatePlaceId(request.params.placeId);
      const place = await repository.getPlace(placeId);
      if (!place) return problem(404, 'Place not found', 'The requested place is not available.', request.traceId);
      return result(200, await repository.getAccessGraph(placeId), PUBLIC_CACHE_HEADERS);
    } catch (error) {
      if (error instanceof PlaceInputError) return problem(400, 'Invalid place ID', problemDetailForInput(error), context.traceId);
      return problem(503, 'Access graph unavailable', 'Access graph information is temporarily unavailable. Please try again.', context.traceId);
    }
  }

  async function categories(context = {}) {
    try {
      const items = await repository.listCategories();
      return result(200, collection(items), PUBLIC_CACHE_HEADERS);
    } catch {
      return problem(503, 'Categories unavailable', 'Place categories are temporarily unavailable.', context.traceId);
    }
  }

  async function features(context = {}) {
    try {
      const items = await repository.listFeatures();
      return result(200, collection(items), PUBLIC_CACHE_HEADERS);
    } catch {
      return problem(503, 'Features unavailable', 'Accessibility features are temporarily unavailable.', context.traceId);
    }
  }

  return Object.freeze({ accessGraph, categories, claims, features, getPlace, search });
}

export function createPlaceRequestHandler({ repository } = {}) {
  const handlers = createPlaceHandlers({ repository });

  return async function handlePlaceRequest({ method = 'GET', pathname, query, traceId } = {}) {
    if (method !== 'GET') return problem(405, 'Method not allowed', 'This resource only accepts GET requests.', traceId);
    const segments = String(pathname ?? '').split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));

    if (segments.length === 2 && segments[0] === 'api' && (segments[1] === 'places' || segments[1] === 'search')) return handlers.search({ query, traceId });
    if (segments.length === 2 && segments[0] === 'api' && segments[1] === 'categories') return handlers.categories({ query, traceId });
    if (segments.length === 2 && segments[0] === 'api' && segments[1] === 'features') return handlers.features({ query, traceId });
    if (segments.length >= 3 && segments[0] === 'api' && segments[1] === 'places') {
      const context = { params: { placeId: segments[2] }, query, traceId };
      if (segments.length === 3) return handlers.getPlace(context);
      if (segments.length === 4 && segments[3] === 'claims') return handlers.claims(context);
      if (segments.length === 4 && segments[3] === 'incidents') return handlers.incidents(context);
      if (segments.length === 4 && segments[3] === 'access-graph') return handlers.accessGraph(context);
    }

    return problem(404, 'Resource not found', 'The requested place resource does not exist.', traceId);
  };
}

export function placeCacheIdentity(params) {
  return boundedCacheKey('place-request', params);
}
