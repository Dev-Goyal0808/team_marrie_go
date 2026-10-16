import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthError } from './errors.mjs';

export const LOCAL_TOKEN_ALGORITHM = 'HS256';
export const LOCAL_TOKEN_TYPE = 'S003';
export const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;

function nowInSeconds(now = Date.now()) {
  const milliseconds = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError('Token time must be a finite millisecond timestamp');
  }
  return Math.floor(milliseconds / 1000);
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(segment, label) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new AuthError({
      code: 'INVALID_TOKEN',
      detail: `The signed token ${label} is not valid base64url data.`
    });
  }

  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch (error) {
    throw new AuthError({
      code: 'INVALID_TOKEN',
      detail: `The signed token ${label} is not valid JSON.`,
      cause: error
    });
  }
}

export function resolveAuthSecret(secret = process.env.AUTH_SECRET) {
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new AuthError({
      code: 'AUTH_SECRET_MISSING',
      status: 500,
      title: 'Authentication is not configured',
      detail: 'AUTH_SECRET must be configured before signed tokens can be used.',
      type: 'https://accessmap.example/problems/configuration'
    });
  }
  return secret;
}

function invalidToken(detail, cause) {
  return new AuthError({
    code: 'INVALID_TOKEN',
    detail,
    cause
  });
}

function signEncodedPayload(encodedHeader, encodedPayload, secret) {
  return createHmac('sha256', resolveAuthSecret(secret))
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
}

/**
 * Create the local S-003 token format. This is a small adapter format for
 * local development and service integration, not a claim that an external
 * identity provider or database is configured.
 */
export function createLocalSignedToken(
  {
    sub,
    userId,
    role = 'user',
    status = 'active',
    issuedAt,
    expiresAt,
    ...claims
  } = {},
  { secret = process.env.AUTH_SECRET, now = Date.now(), ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS } = {}
) {
  const subject = sub ?? userId;
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new TypeError('A token subject is required');
  }
  if (typeof role !== 'string' || role.length === 0) {
    throw new TypeError('A token role is required');
  }
  if (typeof status !== 'string' || status.length === 0) {
    throw new TypeError('A token status is required');
  }

  const issued = issuedAt ?? nowInSeconds(now);
  const expires = expiresAt ?? issued + ttlSeconds;
  if (!Number.isInteger(issued) || !Number.isInteger(expires) || expires <= issued) {
    throw new RangeError('Token issuedAt and expiresAt must be integer seconds with expiresAt after issuedAt');
  }

  const header = {
    alg: LOCAL_TOKEN_ALGORITHM,
    typ: LOCAL_TOKEN_TYPE
  };
  const payload = {
    ...claims,
    sub: subject,
    role,
    status,
    iat: issued,
    exp: expires
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = signEncodedPayload(encodedHeader, encodedPayload, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a local signed token. `now` is a millisecond timestamp,
 * making the function deterministic in tests and straightforward to adapt to
 * a server clock.
 */
export function verifyLocalSignedToken(
  token,
  { secret = process.env.AUTH_SECRET, now = Date.now(), clockToleranceSeconds = 0 } = {}
) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 16 * 1024) {
    throw invalidToken('The bearer token is missing or has an invalid length.');
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw invalidToken('The bearer token does not use the expected three-part format.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  try {
    header = decodeJson(encodedHeader, 'header');
    payload = decodeJson(encodedPayload, 'payload');
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw invalidToken('The bearer token could not be decoded.', error);
  }

  if (
    !header ||
    Array.isArray(header) ||
    header.alg !== LOCAL_TOKEN_ALGORITHM ||
    header.typ !== LOCAL_TOKEN_TYPE
  ) {
    throw invalidToken('The bearer token uses an unsupported signing format.');
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    throw invalidToken('The bearer token payload is invalid.');
  }

  const expectedSignature = signEncodedPayload(encodedHeader, encodedPayload, secret);
  let signaturesMatch = false;
  try {
    const received = Buffer.from(encodedSignature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    signaturesMatch = received.length === expected.length && timingSafeEqual(received, expected);
  } catch (error) {
    throw invalidToken('The bearer token signature is invalid.', error);
  }
  if (!signaturesMatch) {
    throw invalidToken('The bearer token signature is invalid.');
  }

  const current = nowInSeconds(now);
  const tolerance = Number.isInteger(clockToleranceSeconds) && clockToleranceSeconds >= 0
    ? clockToleranceSeconds
    : 0;
  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp)
  ) {
    throw invalidToken('The bearer token is missing required time or subject claims.');
  }
  if (payload.iat > current + tolerance) {
    throw invalidToken('The bearer token was issued in the future.');
  }
  if (payload.exp <= current - tolerance) {
    throw new AuthError({
      code: 'EXPIRED_TOKEN',
      detail: 'The bearer token has expired.'
    });
  }

  return Object.freeze({ ...payload });
}
