import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  body: any;
  expiresAt: number;
  createdAt: number;
}

export class MemoryCacheManager {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Automatically purge expired cache entries every 3 minutes to avoid memory leaks
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, 3 * 60 * 1000);

    // Unref the timer so it doesn't prevent process shutdown
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  public set(key: string, body: any, ttlSeconds: number = 60): void {
    // Avoid caching empty or undefined values
    if (body === undefined || body === null) return;

    this.cache.set(key, {
      body,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    });
  }

  public get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.body;
  }

  public del(patternOrGroup: string): number {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(patternOrGroup)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  public purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public stats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const memoryCache = new MemoryCacheManager();

/**
 * Express Middleware for Route-Level In-Memory Caching
 * @param ttlSeconds Time-to-live in seconds (default: 60s)
 * @param cacheGroup Group identifier for targeted invalidation (e.g. 'blogs', 'leetcode')
 */
export const cacheRoute = (ttlSeconds: number = 60, cacheGroup: string = '') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const group = cacheGroup || req.baseUrl || 'default';
    const cacheKey = `[${group}]:${req.originalUrl}`;
    const cachedData = memoryCache.get(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader(
        'Cache-Control',
        `public, max-age=${Math.min(ttlSeconds, 60)}, stale-while-revalidate=30`
      );
      return res.status(200).json(cachedData);
    }

    // Intercept res.json to capture response payload on success
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(cacheKey, body, ttlSeconds);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader(
          'Cache-Control',
          `public, max-age=${Math.min(ttlSeconds, 60)}, stale-while-revalidate=30`
        );
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate all cached routes belonging to a specific group or prefix.
 * @param cacheGroup Name of the cache group to clear (e.g. 'blogs', 'leetcode', 'events')
 */
export const invalidateCache = (cacheGroup: string): number => {
  const cleared = memoryCache.del(`[${cacheGroup}]`);
  return cleared;
};
