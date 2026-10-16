import { AuthError } from './errors.mjs';
import { verifyLocalSignedToken } from './token.mjs';

function headerValue(headers, name) {
  if (!headers) {
    return undefined;
  }
  if (typeof headers.get === 'function') {
    return headers.get(name) ?? undefined;
  }
  const lowerName = name.toLowerCase();
  if (headers[name] !== undefined) {
    return headers[name];
  }
  if (headers[lowerName] !== undefined) {
    return headers[lowerName];
  }
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  return entry?.[1];
}

export function getAuthorizationHeader(requestOrHeaders) {
  if (typeof requestOrHeaders === 'string') {
    return requestOrHeaders;
  }
  if (requestOrHeaders?.headers) {
    return headerValue(requestOrHeaders.headers, 'authorization');
  }
  return headerValue(requestOrHeaders, 'authorization');
}

/**
 * Return the token from an Authorization header, or null for an anonymous
 * request. A present but malformed header is rejected instead of treated as
 * anonymous.
 */
export function parseBearerToken(authorizationHeader) {
  if (authorizationHeader === undefined || authorizationHeader === null) {
    return null;
  }
  if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
    throw new AuthError({
      code: 'INVALID_AUTHORIZATION',
      detail: 'The Authorization header must contain a bearer token.'
    });
  }

  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || parts[1].length === 0) {
    throw new AuthError({
      code: 'INVALID_AUTHORIZATION',
      detail: 'The Authorization header must use the Bearer scheme.'
    });
  }
  return parts[1];
}

export function anonymousSession() {
  return Object.freeze({
    authenticated: false,
    user: null,
    claims: null
  });
}

function identityFromClaims(claims, loadedUser) {
  const source = loadedUser ?? {};
  const id = source.id ?? source.userId ?? claims.sub;
  const role = source.role ?? claims.role ?? 'user';
  const status = source.status ?? claims.status ?? 'active';
  return {
    ...source,
    id,
    role,
    status
  };
}

/**
 * Validate an incoming session. `loadUser`, when supplied, is the integration
 * point for a durable user store and receives the verified subject and claims.
 * Without it, the signed claims are used only as an explicit local adapter.
 */
export async function validateSession(
  requestOrHeaders,
  {
    secret = process.env.AUTH_SECRET,
    now = Date.now(),
    clockToleranceSeconds = 0,
    loadUser,
    allowSuspended = false
  } = {}
) {
  const token = parseBearerToken(getAuthorizationHeader(requestOrHeaders));
  if (token === null) {
    return anonymousSession();
  }

  const claims = verifyLocalSignedToken(token, { secret, now, clockToleranceSeconds });
  let loadedUser;
  if (loadUser !== undefined) {
    if (typeof loadUser !== 'function') {
      throw new TypeError('loadUser must be a function when supplied');
    }
    loadedUser = await loadUser({ subject: claims.sub, claims });
    if (!loadedUser || typeof loadedUser !== 'object') {
      throw new AuthError({
        code: 'SESSION_NOT_FOUND',
        detail: 'The authenticated user could not be found.'
      });
    }
  }

  const user = identityFromClaims(claims, loadedUser);
  const session = Object.freeze({
    authenticated: true,
    user: Object.freeze(user),
    claims
  });

  if (user.status === 'suspended' && !allowSuspended) {
    throw new AuthError({
      code: 'USER_SUSPENDED',
      status: 403,
      title: 'Account suspended',
      detail: 'This account cannot perform authenticated actions while suspended.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  if (user.status !== 'active' && user.status !== 'suspended') {
    throw new AuthError({
      code: 'USER_INACTIVE',
      status: 403,
      title: 'Account inactive',
      detail: 'This account is not allowed to perform authenticated actions.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }

  return session;
}

export function requireActiveSession(session) {
  if (!session?.authenticated || !session.user) {
    throw new AuthError({
      code: 'AUTHENTICATION_REQUIRED',
      detail: 'Authentication is required for this operation.'
    });
  }
  if (session.user.status === 'suspended') {
    throw new AuthError({
      code: 'USER_SUSPENDED',
      status: 403,
      title: 'Account suspended',
      detail: 'This account cannot perform authenticated actions while suspended.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  if (session.user.status !== 'active') {
    throw new AuthError({
      code: 'USER_INACTIVE',
      status: 403,
      title: 'Account inactive',
      detail: 'This account is not allowed to perform authenticated actions.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  return session;
}
