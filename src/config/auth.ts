import { ErrorType } from '../middlewares/errorHandler';

/**
 * Authentication must always be configured by the deployment environment.
 * A source-controlled fallback would let a leaked repository mint valid tokens.
 */
export const getJwtSecret = (): string => {
    const secret = process.env.APP_SECRET || process.env.JWT_SECRET;

    if (!secret) {
        const error: ErrorType = new Error('Server authentication is not configured');
        error.status = 500;
        throw error;
    }

    return secret;
};

/** Keep profile URLs stable when APP_SECRET/JWT tokens are rotated. */
export const getPublicProfileKeySecret = (): string => process.env.PUBLIC_PROFILE_KEY_SECRET || getJwtSecret();
