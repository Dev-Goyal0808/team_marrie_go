import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { evaluateMatch } from '../../../packages/domain/src/matching/index.mjs';
import { createProblem } from '../../../packages/validation/src/index.mjs';
import {
  AuthError,
  FixedWindowRateLimiter,
  applySecurityHeaders,
  createAuthProblem,
  readJsonBody,
  requireActiveSession,
  requireRole,
  validateRequest,
  validateSession
} from './auth/index.mjs';
import { MemoryCache } from './cache/index.mjs';
import { createDatabasePool, DatabaseUnavailableError } from './db/pool.mjs';
import { SqlRepository } from './db/repository.mjs';
import { ObservationRepository, observationClientRequestId } from './db/observations.mjs';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3001;
const APPLICATION_VERSION = process.env.APP_VERSION ?? '0.1.0';
const OBSERVATION_VALUES = new Set(['yes', 'no', 'partial', 'temporarily_unavailable', 'unknown']);
const REQUIREMENT_LEVELS = new Set(['required', 'preferred', 'avoid']);

export function healthPayload(version = APPLICATION_VERSION, checks = { process: 'ok' }) {
  return {
    schemaVersion: 'health.v1',
    service: 'accessmap-api',
    status: Object.values(checks).every((value) => value === 'ok') ? 'ok' : 'degraded',
    version,
    checks
  };
}

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(body);
}

function sendNoContent(response) {
  response.statusCode = 204;
  response.removeHeader('Content-Length');
  response.end();
}

function routeSegments(pathname) {
  return pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
}

function integerQuery(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
}

function decimalQuery(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseBbox(value) {
  if (!value) return null;
  const parts = String(value).split(',').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return 'invalid';
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = parts;
  if (minLongitude < -180 || maxLongitude > 180 || minLatitude < -90 || maxLatitude > 90 || minLongitude >= maxLongitude || minLatitude >= maxLatitude) return 'invalid';
  return { minLongitude, minLatitude, maxLongitude, maxLatitude };
}

function problem(status, title, detail, traceId, type = 'https://accessmap.example/problems/invalid-request') {
  return createProblem({ status, title, detail, traceId, type });
}

function errorStatus(error) {
  if (error instanceof AuthError || error instanceof DatabaseUnavailableError) return error.status ?? 503;
  return Number.isInteger(error?.status) ? error.status : 500;
}

function errorResponse(error, traceId) {
  if (error instanceof AuthError) return { status: error.status, body: { ...createAuthProblem(error), traceId } };
  if (error instanceof DatabaseUnavailableError) {
    return {
      status: 503,
      body: problem(503, 'Service unavailable', 'The durable data service is not available.', traceId, 'https://accessmap.example/problems/unavailable')
    };
  }
  if (Number.isInteger(error?.status)) {
    return {
      status: error.status,
      body: problem(error.status, error.status === 404 ? 'Resource not found' : 'Invalid request', error.message, traceId)
    };
  }
  return {
    status: 500,
    body: problem(500, 'Internal server error', 'The request could not be completed.', traceId, 'https://accessmap.example/problems/internal')
  };
}

function ensureRepository(repository) {
  if (!repository) throw new DatabaseUnavailableError();
  return repository;
}

function validateRequirements(requirements) {
  if (!Array.isArray(requirements)) {
    const error = new Error('requirements must be an array.');
    error.status = 422;
    throw error;
  }
  const seen = new Set();
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== 'object' || typeof requirement.featureCode !== 'string' || !REQUIREMENT_LEVELS.has(requirement.level)) {
      const error = new Error('Each requirement needs a featureCode and a valid level.');
      error.status = 422;
      throw error;
    }
    if (seen.has(requirement.featureCode)) {
      const error = new Error(`Duplicate match requirement: ${requirement.featureCode}`);
      error.status = 422;
      throw error;
    }
    seen.add(requirement.featureCode);
  }
  return requirements.map(({ featureCode, level }) => ({ featureCode: featureCode.trim(), level }));
}

function validateObservationInput(input, { requireClientRequestId = false } = {}) {
  if (!input || typeof input !== 'object') {
    const error = new Error('A JSON observation object is required.');
    error.status = 422;
    throw error;
  }
  const value = input.value ?? input.observedCondition ?? input.status;
  const normalized = {
    placeId: input.placeId,
    featureCode: input.featureCode,
    value,
    details: input.details ?? input.description ?? null,
    measuredValue: input.measuredValue ?? input.measurement ?? null,
    observedAt: input.observedAt,
    clientRequestId: observationClientRequestId(input)
  };
  if (typeof normalized.placeId !== 'string' || normalized.placeId.length === 0) {
    const error = new Error('placeId is required.');
    error.status = 422;
    throw error;
  }
  if (typeof normalized.featureCode !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(normalized.featureCode)) {
    const error = new Error('featureCode is invalid.');
    error.status = 422;
    throw error;
  }
  if (!OBSERVATION_VALUES.has(normalized.value)) {
    const error = new Error('value must be yes, no, partial, temporarily_unavailable, or unknown.');
    error.status = 422;
    throw error;
  }
  if (typeof normalized.observedAt !== 'string' || Number.isNaN(Date.parse(normalized.observedAt))) {
    const error = new Error('observedAt must be a valid ISO date.');
    error.status = 422;
    throw error;
  }
  if (requireClientRequestId && (typeof input.clientRequestId !== 'string' || input.clientRequestId.length < 8)) {
    const error = new Error('clientRequestId is required for synchronization.');
    error.status = 422;
    throw error;
  }
  return normalized;
}

function publicSession(session) {
  return {
    schemaVersion: 'session.v1',
    authenticated: session.authenticated,
    role: session.authenticated ? session.user.role : 'anonymous',
    userId: session.authenticated ? session.user.id : undefined
  };
}

async function loadSession(request, { repository, authSecret }) {
  return validateSession(request, {
    secret: authSecret,
    loadUser: repository ? async ({ subject }) => repository.getUserByAuthSubject(subject) : undefined
  });
}

async function handleRequest(request, response, context) {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? DEFAULT_HOST}`);
  const traceId = request.headers['x-trace-id'] ?? randomUUID();
  const segments = routeSegments(requestUrl.pathname);
  const method = request.method ?? 'GET';
  const { repository, observationRepository, cache, limiter, authSecret, version, eventHub } = context;
  const session = await loadSession(request, { repository, authSecret });

  if (method === 'GET' && requestUrl.pathname === '/health') {
    const checks = { process: 'ok' };
    if (repository) {
      try {
        checks.database = (await repository.health()) ? 'ok' : 'degraded';
      } catch {
        checks.database = 'degraded';
      }
    }
    sendJson(response, 200, healthPayload(version, checks), { 'X-Trace-Id': traceId });
    return;
  }

  if (method === 'GET' && requestUrl.pathname === '/api/session') {
    sendJson(response, 200, publicSession(session), { 'X-Trace-Id': traceId });
    return;
  }

  if (method === 'GET' && requestUrl.pathname === '/api/categories') {
    sendJson(response, 200, { items: await ensureRepository(repository).listCategories(), schemaVersion: 'categories.v1' });
    return;
  }
  if (method === 'GET' && requestUrl.pathname === '/api/features') {
    sendJson(response, 200, { items: await ensureRepository(repository).listFeatures(), schemaVersion: 'features.v1' });
    return;
  }

  if (method === 'GET' && (requestUrl.pathname === '/api/places' || requestUrl.pathname === '/api/search')) {
    const page = integerQuery(requestUrl.searchParams.get('page'), 1, { min: 1, max: 10_000 });
    const pageSize = integerQuery(requestUrl.searchParams.get('pageSize'), 20, { min: 1, max: 100 });
    const latitude = decimalQuery(requestUrl.searchParams.get('latitude'));
    const longitude = decimalQuery(requestUrl.searchParams.get('longitude'));
    const radius = integerQuery(requestUrl.searchParams.get('radius'), null, { min: 1, max: 50_000 });
    const bbox = parseBbox(requestUrl.searchParams.get('bbox'));
    if ([page, pageSize, latitude, longitude, radius].some((value) => Number.isNaN(value)) || bbox === 'invalid') {
      throw Object.assign(new Error('Search coordinates, radius, bbox, page, or pageSize are invalid.'), { status: 422 });
    }
    const result = await ensureRepository(repository).searchPlaces({
      query: requestUrl.searchParams.get('query') ?? requestUrl.searchParams.get('q') ?? '',
      category: requestUrl.searchParams.get('category'),
      city: requestUrl.searchParams.get('city'),
      latitude,
      longitude,
      radius,
      bbox,
      features: requestUrl.searchParams.get('features'),
      page,
      pageSize,
      sort: requestUrl.searchParams.get('sort') ?? 'distance'
    });
    sendJson(response, 200, { schemaVersion: 'place-search.v1', ...result }, { 'X-Trace-Id': traceId });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'places' && segments[2]) {
    const placeId = segments[2];
    if (method === 'GET' && segments.length === 3) {
      const place = await ensureRepository(repository).getPlace(placeId);
      if (!place) throw Object.assign(new Error('Place not found.'), { status: 404 });
      sendJson(response, 200, { schemaVersion: 'place-detail.v1', ...place }, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'GET' && segments[3] === 'claims') {
      sendJson(response, 200, { schemaVersion: 'claims.v1', items: await ensureRepository(repository).listClaims(placeId) }, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'GET' && segments[3] === 'incidents') {
      sendJson(response, 200, { schemaVersion: 'incidents.v1', items: await ensureRepository(repository).listIncidents({ placeId }) }, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'GET' && segments[3] === 'access-graph') {
      sendJson(response, 200, { schemaVersion: 'access-graph.v1', ...await ensureRepository(repository).getAccessGraph(placeId) }, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'GET' && segments[3] === 'match') {
      requireActiveSession(session);
      const profile = await ensureRepository(repository).getProfile(session.user.id);
      const claims = await ensureRepository(repository).claimsForMatch(placeId);
      sendJson(response, 200, { schemaVersion: 'match-explanation.v1', ...evaluateMatch(profile, claims) }, { 'X-Trace-Id': traceId });
      return;
    }
  }

  if (method === 'GET' && requestUrl.pathname === '/api/incidents') {
    const bbox = parseBbox(requestUrl.searchParams.get('bbox'));
    if (bbox === 'invalid') throw Object.assign(new Error('bbox is invalid.'), { status: 422 });
    sendJson(response, 200, { schemaVersion: 'incidents.v1', items: await ensureRepository(repository).listIncidents({ bbox }) }, { 'X-Trace-Id': traceId });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'me' && segments[2] === 'access-match-profile') {
    requireActiveSession(session);
    if (method === 'GET') {
      const profile = await ensureRepository(repository).getProfile(session.user.id);
      sendJson(response, 200, profile ?? { userId: session.user.id, requirements: [], version: 0 }, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'PATCH') {
      validateRequest(request);
      const body = await readJsonBody(request);
      const requirements = validateRequirements(body.requirements);
      const saved = await ensureRepository(repository).upsertProfile(session.user.id, requirements);
      sendJson(response, 200, saved, { 'X-Trace-Id': traceId });
      return;
    }
  }

  if (method === 'POST' && requestUrl.pathname === '/api/matches/places') {
    validateRequest(request);
    const body = await readJsonBody(request);
    const requirements = validateRequirements(body.profile?.requirements ?? body.requirements ?? []);
    const placeIds = body.placeIds ?? (body.placeId ? [body.placeId] : []);
    if (!Array.isArray(placeIds) || placeIds.length === 0 || placeIds.length > 50) throw Object.assign(new Error('placeId or placeIds is required.'), { status: 422 });
    const items = [];
    for (const placeId of placeIds) {
      const claims = await ensureRepository(repository).claimsForMatch(placeId);
      items.push({ placeId, ...evaluateMatch({ requirements }, claims) });
    }
    sendJson(response, 200, { schemaVersion: 'match-results.v1', items }, { 'X-Trace-Id': traceId });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'me' && segments[2] === 'observations' && method === 'GET') {
    requireActiveSession(session);
    const page = integerQuery(requestUrl.searchParams.get('page'), 1, { min: 1, max: 10_000 });
    const pageSize = integerQuery(requestUrl.searchParams.get('pageSize'), 20, { min: 1, max: 100 });
    if ([page, pageSize].some((value) => Number.isNaN(value))) throw Object.assign(new Error('Pagination is invalid.'), { status: 422 });
    sendJson(response, 200, await observationRepository.listForUser(session.user.id, { page, pageSize }), { 'X-Trace-Id': traceId });
    return;
  }

  if (method === 'POST' && (requestUrl.pathname === '/api/observations' || requestUrl.pathname === '/api/observations/sync')) {
    requireActiveSession(session);
    const key = `reports:${session.user.id}`;
    const rate = limiter.consume(key);
    if (!rate.allowed) {
      sendJson(response, 429, problem(429, 'Too many requests', 'Please wait before submitting another report.', traceId, 'https://accessmap.example/problems/rate-limit'), rate.headers);
      return;
    }
    validateRequest(request, { maxBytes: 256 * 1024 });
    const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
    const items = requestUrl.pathname.endsWith('/sync') ? body.items : [body];
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw Object.assign(new Error('The observation payload must contain between 1 and 50 items.'), { status: 422 });
    const results = [];
    for (const item of items) {
      const input = validateObservationInput(item, { requireClientRequestId: requestUrl.pathname.endsWith('/sync') });
      const result = await observationRepository.createObservation(session.user.id, input);
      results.push({ ...result.observation, synced: result.duplicate || requestUrl.pathname.endsWith('/sync'), duplicate: result.duplicate });
    }
    sendJson(response, requestUrl.pathname.endsWith('/sync') ? 200 : 201, requestUrl.pathname.endsWith('/sync') ? { items: results } : results[0], { 'X-Trace-Id': traceId, ...rate.headers });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'observations' && segments[2]) {
    const observationId = segments[2];
    if (method === 'GET' && segments.length === 3) {
      const observation = await observationRepository.getById(observationId);
      if (!observation) throw Object.assign(new Error('Observation not found.'), { status: 404 });
      if (!session.authenticated || (observation.contributor_id !== session.user.id && !['moderator', 'admin'].includes(session.user.role))) {
        if (observation.visibility !== 'public' || observation.moderation_status !== 'approved') requireActiveSession(session);
      }
      sendJson(response, 200, observation, { 'X-Trace-Id': traceId });
      return;
    }
    if (method === 'POST' && ['verify', 'dispute', 'outdated'].includes(segments[3])) {
      requireActiveSession(session);
      validateRequest(request);
      const body = await readJsonBody(request);
      const eventType = segments[3] === 'verify' ? 'confirmed' : segments[3];
      sendJson(response, 201, await observationRepository.verify(session.user.id, observationId, eventType, body.comment ?? null), { 'X-Trace-Id': traceId });
      return;
    }
  }

  if (segments[0] === 'api' && segments[1] === 'moderation' && segments[2] === 'items' && segments[3] && method === 'POST') {
    requireActiveSession(session);
    requireRole(session, ['moderator', 'admin']);
    const action = segments[4] === 'request-changes' ? 'request-changes' : segments[4];
    validateRequest(request);
    const body = await readJsonBody(request);
    sendJson(response, 200, await observationRepository.moderate({ moderatorId: session.user.id, itemId: segments[3], action, resolution: body.resolution ?? null }), { 'X-Trace-Id': traceId });
    return;
  }

  if (method === 'GET' && requestUrl.pathname.startsWith('/api/stream/')) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-store');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Trace-Id', traceId);
    response.write(`event: ready\ndata: ${JSON.stringify({ schemaVersion: 'stream.v1', traceId })}\n\n`);
    const unsubscribe = eventHub.subscribe(response, requestUrl.pathname);
    request.on('close', unsubscribe);
    return;
  }

  sendJson(response, 404, problem(404, 'Resource not found', 'The requested API resource does not exist.', traceId, 'https://accessmap.example/problems/not-found'), { 'X-Trace-Id': traceId });
}

class EventHub {
  constructor() {
    this.subscribers = new Map();
    this.nextId = 1;
  }

  subscribe(response, topic) {
    const id = this.nextId++;
    this.subscribers.set(id, { response, topic });
    return () => this.subscribers.delete(id);
  }

  publish(topic, event, payload) {
    const body = `id: ${event}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, subscriber] of this.subscribers) {
      if (subscriber.topic !== topic && subscriber.topic !== '/api/stream/map') continue;
      try {
        subscriber.response.write(body);
      } catch {
        this.subscribers.delete(id);
      }
    }
  }
}

export function createApiServer({
  version = APPLICATION_VERSION,
  pool = createDatabasePool(),
  repository = pool ? new SqlRepository(pool) : null,
  observationRepository = pool ? new ObservationRepository(pool) : null,
  cache = new MemoryCache(),
  limiter = new FixedWindowRateLimiter(),
  authSecret = process.env.AUTH_SECRET,
  eventHub = new EventHub()
} = {}) {
  const server = createServer(async (request, response) => {
    applySecurityHeaders(response, { https: process.env.NODE_ENV === 'production' });
    try {
      await handleRequest(request, response, {
        version,
        pool,
        repository,
        observationRepository,
        cache,
        limiter,
        authSecret,
        eventHub
      });
    } catch (error) {
      const traceId = request.headers['x-trace-id'] ?? randomUUID();
      const result = errorResponse(error, traceId);
      sendJson(response, result.status, result.body, {
        'X-Trace-Id': traceId,
        ...(error.headers ?? {})
      });
    }
  });
  return server;
}

export function startApiServer({
  host = process.env.API_HOST ?? DEFAULT_HOST,
  port = Number(process.env.API_PORT ?? DEFAULT_PORT),
  version,
  ...options
} = {}) {
  const server = createApiServer({ version, ...options });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve({ server, host, port: server.address().port });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { host, port } = await startApiServer();
  process.stdout.write(`AccessMap API listening at http://${host}:${port}\n`);
}
