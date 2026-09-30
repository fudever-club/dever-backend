import { Response } from 'express';

/**
 * Centralized NoSQL-injection guard (Phase 1, no new deps).
 * express-mongo-sanitize is NOT installed, so every filter built from
 * query/body must pass through these helpers instead of trusting Express'
 * extended (qs) parser output — `?category[$ne]=x` parses to an object
 * whose `$ne` key would otherwise become a Mongo operator.
 */

/** A key must never become a Mongo field/operator when it looks like `$...` or `a.b`. */
export const hasNoSqlKey = (key: string): boolean => key.startsWith('$') || key.includes('.');

/** Recursively detect operator/dotted keys anywhere in a parsed value. */
export const containsNoSqlOperator = (value: unknown, depth = 0): boolean => {
    if (depth > 10 || value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some((item) => containsNoSqlOperator(item, depth + 1));
    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).some(
            ([key, nested]) => hasNoSqlKey(key) || containsNoSqlOperator(nested, depth + 1),
        );
    }
    return false;
};

/** Only scalars may pass into a Mongo filter value — objects/arrays hide operators. */
export const isPlainFilterScalar = (value: unknown): value is string | number | boolean =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** Uniform 400 VALIDATION_ERROR responder for all NoSQL-guard rejections. */
export const rejectNoSql = (res: Response, message = 'Invalid filter format') =>
    res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message });

/**
 * Extract a single string query param. Returns undefined when absent, the
 * string when valid, or null when the caller passed an object/array
 * (e.g. `?q[$ne]=...`) which must be rejected with 400, never coerced.
 */
export const asSingleStringParam = (value: unknown): string | undefined | null => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return null;
};
