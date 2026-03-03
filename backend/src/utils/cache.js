const env = require("../config/env");

class InMemoryTtlCache {
  constructor({ maxEntries = 5000 } = {}) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  pruneExpired(now = Date.now()) {
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  ensureCapacity() {
    if (this.store.size <= this.maxEntries) {
      return;
    }

    const overflow = this.store.size - this.maxEntries;
    const oldestKeys = Array.from(this.store.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, overflow)
      .map(([key]) => key);

    for (const key of oldestKeys) {
      this.store.delete(key);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    const now = Date.now();
    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    this.pruneExpired(now);
    this.ensureCapacity();
  }

  delete(key) {
    this.store.delete(key);
  }

  invalidateByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

function createCacheManager({
  enabled = env.CACHE_ENABLED,
  defaultTtlMs = env.CACHE_DEFAULT_TTL_MS,
  maxEntries = env.CACHE_MAX_ENTRIES,
} = {}) {
  const cache = new InMemoryTtlCache({
    maxEntries,
  });

  function get(key) {
    if (!enabled) {
      return undefined;
    }
    return cache.get(key);
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    if (!enabled) {
      return;
    }
    cache.set(key, value, ttlMs);
  }

  function del(key) {
    if (!enabled) {
      return;
    }
    cache.delete(key);
  }

  function invalidateByPrefix(prefix) {
    if (!enabled) {
      return;
    }
    cache.invalidateByPrefix(prefix);
  }

  function clear() {
    cache.clear();
  }

  return {
    get,
    set,
    delete: del,
    invalidateByPrefix,
    clear,
    isEnabled: enabled,
  };
}

module.exports = {
  InMemoryTtlCache,
  createCacheManager,
};
