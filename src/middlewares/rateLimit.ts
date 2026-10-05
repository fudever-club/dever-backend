import { NextFunction, Request, Response } from 'express';
import { redisConfigured, redisIncr } from '../services/redisStore';

type RateLimitOptions = {
    /** Sliding window length in milliseconds. */
    windowMs: number;
    /** Max requests per window per IP per route. */
    max: number;
    /** Message returned with HTTP 429. */
    message?: string;
};

type HitRecord = { count: number; resetAt: number };

const hits = new Map<string, HitRecord>();

// Periodic cleanup so the map cannot grow unbounded. unref() keeps this
// timer from holding the Node process open on its own.
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits) {
        if (record.resetAt <= now) {
            hits.delete(key);
        }
    }
    // Hard cap as a second safety net.
    if (hits.size > 20000) {
        const oldest = Array.from(hits.keys()).slice(0, hits.size - 20000);
        for (const key of oldest) {
            hits.delete(key);
        }
    }
}, 60_000);
cleanupTimer.unref();

/**
 * Zero-dependency sliding-window rate limiter with a shared Redis budget.
 * Suitable for a single Node process; when UPSTASH_* is configured every
 * instance shares one budget, otherwise (or when Redis is slow/down) each
 * process falls back to its local map without failing the request.
 */
export const rateLimit = (options: RateLimitOptions) => {
    const { windowMs, max, message } = options;
    const tooMany = (res: Response, retryAfter: number) => {
        res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
        return res.status(429).json({
            status: 'error',
            message: message || 'Too many requests, please try again later',
        });
    };
    return async (req: Request, res: Response, next: NextFunction) => {
        const key = `${req.ip || 'unknown'}:${req.baseUrl}${req.path}`;
        const now = Date.now();
        // Shared budget first (no-op when Redis is unconfigured/failing).
        if (redisConfigured()) {
            try {
                const shared = await redisIncr(`rl:${key}`, windowMs / 1000);
                if (shared !== null) {
                    if (shared > max) {
                        return tooMany(res, Math.ceil(windowMs / 1000));
                    }
                    return next();
                }
            } catch {
                // Fall through to the local budget below.
            }
        }
        const record = hits.get(key);
        if (!record || record.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        record.count += 1;
        if (record.count > max) {
            const retryAfter = Math.ceil((record.resetAt - now) / 1000);
            return tooMany(res, retryAfter);
        }
        return next();
    };
};

/** Brute-force guard for password login (per IP). */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts, please try again later',
});

/** Token rotation endpoint gets its own budget so login bursts cannot lock it. */
export const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: 'Too many refresh attempts, please try again later',
});

/** verifyToken returns a full private DTO — bound token-oracle probing. */
export const verifyTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: 'Too many verification attempts, please try again later',
});

/** Telegram sends retries/bursts; still cap abuse of the public webhook. */
export const telegramWebhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: 'Too many requests, please try again later',
});

/** Client crash loops must not flood the observability buffer. */
export const errorReportLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many requests, please try again later',
});

/** Blog likes mutate counts and bust the blogs cache — bound toggle spam. */
export const blogLikeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many like attempts, please try again later',
});

/** Public invite validate/accept: strict budget so tokens cannot be enumerated. */
export const inviteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many invite attempts, please try again later',
});

/** LeetCode sync fans out to an external API per user — expensive. */
export const leetcodeUpdateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Sync is rate limited, please try again later',
});

/** Mentorship requests ping mentors — bound request spam per IP. */
export const mentorshipLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many mentorship requests, please try again later',
});
