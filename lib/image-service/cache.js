'use strict';

/** In-memory search cache — prevents repeated provider calls on re-render. */

const store = new Map();
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function cacheKey(parts) {
  return JSON.stringify(parts);
}

function getCached(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + (ttlMs || DEFAULT_TTL_MS) });
  return value;
}

function clearCache() {
  store.clear();
}

function cacheSize() {
  return store.size;
}

module.exports = {
  cacheKey,
  getCached,
  setCached,
  clearCache,
  cacheSize,
  DEFAULT_TTL_MS
};
