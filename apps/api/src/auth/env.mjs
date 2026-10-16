import { AuthError } from './errors.mjs';

export const MIN_AUTH_SECRET_LENGTH = 32;

/** Validate required auth configuration at process startup without mutating env. */
export function validateStartupEnvironment(
  env = process.env,
  { requireAuthSecret = true, minSecretLength = MIN_AUTH_SECRET_LENGTH } = {}
) {
  if (!Number.isSafeInteger(minSecretLength) || minSecretLength < 1) {
    throw new RangeError('minSecretLength must be a positive safe integer');
  }

  const secret = env?.AUTH_SECRET;
  if (requireAuthSecret && (typeof secret !== 'string' || secret.trim().length === 0)) {
    throw new AuthError({
      code: 'AUTH_SECRET_MISSING',
      status: 500,
      title: 'Authentication is not configured',
      detail: 'AUTH_SECRET must be configured at startup.',
      type: 'https://accessmap.example/problems/configuration'
    });
  }
  if (typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') < minSecretLength) {
    throw new AuthError({
      code: 'AUTH_SECRET_WEAK',
      status: 500,
      title: 'Authentication is not configured securely',
      detail: `AUTH_SECRET must be at least ${minSecretLength} bytes long.`,
      type: 'https://accessmap.example/problems/configuration'
    });
  }

  const tokenTtl = env?.AUTH_TOKEN_TTL_SECONDS;
  let tokenTtlSeconds;
  if (tokenTtl !== undefined) {
    if (!/^\d+$/.test(String(tokenTtl)) || Number(tokenTtl) < 1 || !Number.isSafeInteger(Number(tokenTtl))) {
      throw new AuthError({
        code: 'AUTH_TOKEN_TTL_INVALID',
        status: 500,
        title: 'Authentication is not configured',
        detail: 'AUTH_TOKEN_TTL_SECONDS must be a positive integer.',
        type: 'https://accessmap.example/problems/configuration'
      });
    }
    tokenTtlSeconds = Number(tokenTtl);
  }

  return {
    authSecret: secret,
    ...(tokenTtlSeconds === undefined ? {} : { tokenTtlSeconds })
  };
}

export const validateAuthEnvironment = validateStartupEnvironment;
