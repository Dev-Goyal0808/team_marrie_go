import { createHash } from 'node:crypto';

export function boundedCacheKey(namespace, value) {
  const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return `accessmap:${namespace}:${digest}`;
}

export async function readJsonCache(cache, key) {
  if (!cache?.get) return null;
  try {
    const value = await cache.get(key);
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

export async function writeJsonCache(cache, key, value, ttlSeconds) {
  if (!cache?.set) return false;
  try {
    const serialized = JSON.stringify(value);
    if (cache.set.length >= 3) await cache.set(key, serialized, ttlSeconds);
    else await cache.set(key, serialized, { ttlSeconds });
    return true;
  } catch {
    return false;
  }
}
