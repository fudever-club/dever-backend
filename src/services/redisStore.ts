/**
 * Shared rate-limit budget over Upstash Redis REST (zero new dependencies —
 * plain fetch, available on Node 22). Every call is fail-open: unconfigured,
 * slow (>800ms), or erroring Redis falls back to the in-memory limiter so
 * availability never depends on the shared store.
 */

const restUrl = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const redisConfigured = (): boolean => restUrl.length > 0 && restToken.length > 0;

const redisCmd = async (args: Array<string | number>): Promise<any | null> => {
    if (!redisConfigured()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    try {
        const response = await fetch(restUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${restToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
            signal: controller.signal as any,
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { result?: any };
        return payload?.result ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Fixed-window increment. Returns the new count, or null when Redis is
 * unavailable (caller must use its local fallback).
 */
export const redisIncr = async (key: string, windowSeconds: number): Promise<number | null> => {
    const count = await redisCmd(['INCR', key]);
    if (count === null || count === undefined) return null;
    const numeric = Number(count);
    if (!Number.isFinite(numeric)) return null;
    if (numeric === 1) {
        await redisCmd(['EXPIRE', key, Math.max(1, Math.ceil(windowSeconds))]);
    }
    return numeric;
};

/**
 * Shared read cache (JSON values). Fail-open null on any error so callers
 * always fall back to memory/origin. Values cap ~256KB to stay well under
 * Upstash REST command limits.
 */
const MAX_CACHE_BYTES = 256 * 1024;

export const redisGetJson = async (key: string): Promise<any | null | undefined> => {
    const raw = await redisCmd(['GET', key]);
    if (typeof raw !== 'string' || raw.length === 0) return raw === null ? null : undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

export const redisSetJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    let encoded: string;
    try {
        encoded = JSON.stringify(value);
    } catch {
        return;
    }
    if (encoded.length > MAX_CACHE_BYTES) return;
    await redisCmd(['SET', key, encoded, 'EX', Math.max(1, Math.ceil(ttlSeconds))]);
};

/** Best-effort group invalidation via SCAN + DEL (bounded iterations). */
export const redisDelGroup = async (groupPrefix: string): Promise<number> => {
    let cursor = '0';
    let deleted = 0;
    for (let round = 0; round < 20; round += 1) {
        const page: any = await redisCmd(['SCAN', cursor, 'MATCH', `${groupPrefix}*`, 'COUNT', 100]);
        if (!Array.isArray(page) || page.length < 2) return deleted;
        cursor = String(page[0]);
        const keys = (page[1] as unknown[]).map(String).filter(Boolean);
        if (keys.length > 0) {
            await redisCmd(['DEL', ...keys]);
            deleted += keys.length;
        }
        if (cursor === '0') return deleted;
    }
    return deleted;
};
