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
