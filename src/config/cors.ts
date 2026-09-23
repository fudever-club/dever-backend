/**
 * Single source of truth for browser origin policy. Allowlisting is exact:
 * an origin is accepted only if it appears in the built-in roster, in the
 * `CORS_ORIGINS` environment variable, or as the explicitly configured
 * preview origin passed by the caller. Hosting-tenant wildcards
 * (`*.vercel.app`, `*.workers.dev`, …) are intentionally NOT accepted —
 * every tenant must be named, so a stranger's deployment can never ride on
 * our API credentials.
 */

const BUILT_IN_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3003',
    'https://fudever.com',
    'https://www.fudever.com',
    'https://client.fudever.com',
    'https://admin.fudever.com',
    'http://fudever.com',
    'http://www.fudever.com',
    'http://client.fudever.com',
    'http://admin.fudever.com',
    'https://fu-dever-landingpage-v2.vercel.app',
    'https://dever-client-sigma.vercel.app',
    'https://dever-admin-three.vercel.app',
    'https://dever-client-taupe.vercel.app',
    'https://dever-admin-lac.vercel.app',
    'https://dashboard.fu-dever.com',
    'https://admin.fu-dever.com',
    'https://fu-dever.com',
    'https://www.fu-dever.com',
    'https://client.fu-dever.com',
    'https://admin.fu-dever.com',
];

const readEnvOrigins = (): string[] =>
    process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
        : [];

export const buildAllowedOrigins = (configuredOrigin?: string): string[] => {
    const origins = new Set<string>([...BUILT_IN_ORIGINS, ...readEnvOrigins()]);
    if (configuredOrigin) {
        origins.add(configuredOrigin);
    }
    return Array.from(origins);
};

export interface CorsOptions {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
}

/** `origin === undefined` covers non-browser callers (curl, server-to-server). */
export const createCorsOptions = (configuredOrigin?: string): CorsOptions => {
    const allowedOrigins = buildAllowedOrigins(configuredOrigin);
    return {
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    };
};
