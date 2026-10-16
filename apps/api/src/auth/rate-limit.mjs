import { AuthError } from './errors.mjs';

function timestamp(now) {
  const value = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(value)) {
    throw new TypeError('Rate limiter time must be a finite millisecond timestamp');
  }
  return value;
}

function defaultKeyGenerator(request) {
  if (typeof request === 'string') {
    return request;
  }
  return request?.socket?.remoteAddress ?? request?.connection?.remoteAddress ?? 'anonymous';
}

/**
 * In-memory fixed-window limiter. It is intentionally an adapter: use a
 * distributed implementation with the same consume result when the API is
 * deployed across multiple processes.
 */
export class FixedWindowRateLimiter {
  constructor({ limit = 60, windowMs = 60_000, now = Date.now, keyGenerator = defaultKeyGenerator } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('limit must be a positive safe integer');
    }
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
      throw new RangeError('windowMs must be a positive safe integer');
    }
    if (typeof now !== 'function' || typeof keyGenerator !== 'function') {
      throw new TypeError('now and keyGenerator must be functions');
    }
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.keyGenerator = keyGenerator;
    this.entries = new Map();
  }

  consume(subject, cost = 1) {
    if (!Number.isSafeInteger(cost) || cost < 1) {
      throw new RangeError('cost must be a positive safe integer');
    }
    const key = String(this.keyGenerator(subject));
    const currentTime = timestamp(this.now());
    this.pruneExpired(currentTime);
    const windowStart = Math.floor(currentTime / this.windowMs) * this.windowMs;
    const resetAt = windowStart + this.windowMs;
    const existing = this.entries.get(key);
    const entry = existing?.windowStart === windowStart
      ? existing
      : { windowStart, count: 0 };
    const accepted = entry.count < this.limit && entry.count + cost <= this.limit;
    if (accepted) {
      entry.count += cost;
    }
    this.entries.set(key, entry);

    return {
      allowed: accepted,
      limit: this.limit,
      remaining: Math.max(0, this.limit - entry.count),
      resetAt,
      retryAfterSeconds: accepted ? 0 : Math.max(1, Math.ceil((resetAt - currentTime) / 1000))
    };
  }

  pruneExpired(at = this.now()) {
    const currentTime = timestamp(at);
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.windowStart + this.windowMs <= currentTime) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  check(subject, cost = 1) {
    return this.consume(subject, cost);
  }

  reset(subject) {
    const key = String(this.keyGenerator(subject));
    return this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  size() {
    return this.entries.size;
  }
}

export function rateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}

export function rateLimitProblem(result) {
  if (result.allowed) {
    return null;
  }
  return {
    schemaVersion: 'problem.v1',
    type: 'https://accessmap.example/problems/rate-limit',
    title: 'Too many requests',
    status: 429,
    detail: 'Too many requests were received. Try again after the rate-limit window resets.',
    code: 'RATE_LIMITED'
  };
}

export function rateLimitError(result) {
  if (result.allowed) {
    return null;
  }
  return new AuthError({
    code: 'RATE_LIMITED',
    status: 429,
    title: 'Too many requests',
    detail: 'Too many requests were received. Try again after the rate-limit window resets.',
    type: 'https://accessmap.example/problems/rate-limit',
    headers: rateLimitHeaders(result)
  });
}

export function checkRateLimit(requestOrKey, limiter, { cost = 1 } = {}) {
  if (!limiter || typeof limiter.consume !== 'function') {
    throw new TypeError('A rate limiter with consume(subject, cost) is required');
  }
  const result = limiter.consume(requestOrKey, cost);
  return {
    ...result,
    problem: rateLimitProblem(result),
    headers: rateLimitHeaders(result)
  };
}
