import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import {
  AuthError,
  FixedWindowRateLimiter,
  applySecurityHeaders,
  checkRateLimit,
  createLocalSignedToken,
  hasRole,
  ownsResource,
  parseBearerToken,
  rateLimitProblem,
  requireActiveSession,
  requireOwnership,
  requireRole,
  readJsonBody,
  securityHeaders,
  validateContentType,
  validateRequest,
  validateRequestSize,
  validateStartupEnvironment,
  validateSession,
  verifyLocalSignedToken
} from '../../src/auth/index.mjs';

const SECRET = 's003-test-secret-012345678901234567890';
const NOW = 1_700_000_000_000;

function token(options = {}) {
  return createLocalSignedToken(options, { secret: SECRET, now: NOW });
}

function bearer(value) {
  return { headers: { authorization: `Bearer ${value}` } };
}

test('anonymous requests produce an unauthenticated session', async () => {
  const session = await validateSession({ headers: {} }, { secret: SECRET });

  assert.deepEqual(session, {
    authenticated: false,
    user: null,
    claims: null
  });
  assert.equal(parseBearerToken(undefined), null);
});

test('invalid, expired, and malformed bearer tokens are rejected', async () => {
  const validToken = token({ sub: 'user-1' });
  const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;

  await assert.rejects(
    () => validateSession(bearer(tamperedToken), { secret: SECRET, now: NOW }),
    (error) => error instanceof AuthError && error.code === 'INVALID_TOKEN' && error.status === 401
  );

  const expiredToken = token({ sub: 'user-1', issuedAt: 1_700_000_000, expiresAt: 1_700_000_001 });
  assert.throws(
    () => verifyLocalSignedToken(expiredToken, { secret: SECRET, now: 1_700_000_002_000 }),
    (error) => error instanceof AuthError && error.code === 'EXPIRED_TOKEN'
  );

  await assert.rejects(
    () => validateSession({ headers: { authorization: 'Basic not-a-bearer-token' } }, { secret: SECRET }),
    (error) => error instanceof AuthError && error.code === 'INVALID_AUTHORIZATION'
  );
});

test('session claims can be checked against roles', async () => {
  const session = await validateSession(bearer(token({ sub: 'mod-1', role: 'moderator' })), {
    secret: SECRET,
    now: NOW
  });

  assert.equal(hasRole(session, 'moderator'), true);
  assert.equal(hasRole(session, 'user'), false);
  assert.equal(requireRole(session, ['moderator', 'admin']).id, 'mod-1');
  assert.throws(
    () => requireRole(session, 'facility_manager'),
    (error) => error instanceof AuthError && error.code === 'FORBIDDEN_ROLE'
  );
});

test('suspended users cannot pass active-session checks', async () => {
  const suspendedToken = token({ sub: 'suspended-1', status: 'suspended' });

  await assert.rejects(
    () => validateSession(bearer(suspendedToken), { secret: SECRET, now: NOW }),
    (error) => error instanceof AuthError && error.code === 'USER_SUSPENDED' && error.status === 403
  );

  const suspendedSession = await validateSession(bearer(suspendedToken), {
    secret: SECRET,
    now: NOW,
    allowSuspended: true
  });
  assert.throws(
    () => requireActiveSession(suspendedSession),
    (error) => error instanceof AuthError && error.code === 'USER_SUSPENDED'
  );
});

test('ownership checks prevent access to another user private resource', async () => {
  const session = await validateSession(bearer(token({ sub: 'user-1' })), {
    secret: SECRET,
    now: NOW
  });

  assert.equal(ownsResource(session, { ownerId: 'user-1' }), true);
  assert.equal(ownsResource(session, { ownerId: 'user-2' }), false);
  assert.equal(requireOwnership(session, { ownerId: 'user-1' }).id, 'user-1');
  assert.throws(
    () => requireOwnership(session, { ownerId: 'user-2' }),
    (error) => error instanceof AuthError && error.code === 'FORBIDDEN_OWNERSHIP'
  );
});

test('security headers and request validation provide safe adapter defaults', async () => {
  const headers = securityHeaders();
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(headers['Strict-Transport-Security'], undefined);
  assert.match(securityHeaders({ https: true })['Strict-Transport-Security'], /max-age=/);

  const responseHeaders = new Map();
  applySecurityHeaders({ setHeader(name, value) { responseHeaders.set(name, value); } });
  assert.equal(responseHeaders.get('Referrer-Policy'), 'no-referrer');

  assert.deepEqual(
    validateRequest(
      { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': '2' } },
      { maxBytes: 10 }
    ),
    { contentLength: 2, maxBytes: 10, contentType: 'application/json' }
  );
  assert.throws(
    () => validateContentType({ 'content-type': 'text/plain' }),
    (error) => error instanceof AuthError && error.code === 'UNSUPPORTED_CONTENT_TYPE' && error.status === 415
  );
  assert.throws(
    () => validateRequestSize({ 'content-length': '11' }, { maxBytes: 10 }),
    (error) => error instanceof AuthError && error.code === 'REQUEST_TOO_LARGE' && error.status === 413
  );

  const request = Readable.from(['{"ok":true}']);
  request.headers = { 'content-type': 'application/json', 'content-length': '11' };
  request.method = 'POST';
  assert.deepEqual(await readJsonBody(request, { maxBytes: 20 }), { ok: true });
});

test('startup environment validation rejects missing and weak secrets', () => {
  assert.deepEqual(validateStartupEnvironment({ AUTH_SECRET: SECRET }), { authSecret: SECRET });
  assert.throws(
    () => validateStartupEnvironment({}),
    (error) => error instanceof AuthError && error.code === 'AUTH_SECRET_MISSING'
  );
  assert.throws(
    () => validateStartupEnvironment({ AUTH_SECRET: 'too-short' }),
    (error) => error instanceof AuthError && error.code === 'AUTH_SECRET_WEAK'
  );
});

test('fixed-window rate limiter returns a documented problem after its limit', () => {
  let now = 100;
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });

  const first = checkRateLimit('user-1', limiter);
  const second = checkRateLimit('user-1', limiter);
  const third = checkRateLimit('user-1', limiter);

  assert.equal(first.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.problem.status, 429);
  assert.equal(third.problem.schemaVersion, 'problem.v1');
  assert.equal(third.problem.code, 'RATE_LIMITED');
  assert.equal(third.headers['Retry-After'], '1');
  assert.equal(rateLimitProblem(first), null);

  now = 1_000;
  assert.equal(limiter.check('user-1').allowed, true);
});
