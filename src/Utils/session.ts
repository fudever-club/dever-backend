import { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getJwtSecret } from '../config/auth';
import { RefreshToken } from '../models/RefreshTokenModel';

const jwt = require('jsonwebtoken');

/** Cookie names are distinct from legacy JS-readable storage keys on purpose. */
export const ACCESS_COOKIE = 'dever_at';
export const REFRESH_COOKIE = 'dever_rt';

/** Access expiry stays at the legacy 7d during the transition so existing
 *  clients holding body tokens are not logged out. Tighten only after the
 *  frontends complete the refresh flow. */
export const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

const cookieSecure = (req: Request): boolean =>
    req.secure ||
    req.get('x-forwarded-proto') === 'https' ||
    process.env.COOKIE_SECURE === 'true';

export const setAuthCookies = (
    req: Request,
    res: Response,
    tokens: { access: string; refresh: string },
): void => {
    const secure = cookieSecure(req);
    const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, tokens.access, { ...base, maxAge: ACCESS_TTL_MS });
    res.cookie(REFRESH_COOKIE, tokens.refresh, { ...base, maxAge: REFRESH_TTL_MS });
};

export const clearAuthCookies = (req: Request, res: Response): void => {
    const secure = cookieSecure(req);
    const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
};

export const parseBearerToken = (req: Request): string | null => {
    const authorization = req.header('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return null;
    }
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
};

/** Prefer the httpOnly cookie; fall back to the legacy Authorization header. */
export const readAccessToken = (req: Request): string | null => {
    const fromCookie = (req.cookies as any)?.[ACCESS_COOKIE];
    if (typeof fromCookie === 'string' && fromCookie) {
        return fromCookie;
    }
    return parseBearerToken(req);
};

export const issueSession = async (
    userId: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });
    const refreshToken = randomBytes(48).toString('hex');
    await RefreshToken.create({
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return { accessToken, refreshToken };
};

type RotateResult =
    | { status: 'ok'; accessToken: string; refreshToken: string; userId: string }
    | { status: 'invalid' | 'reused' };

export const rotateSession = async (presented: string): Promise<RotateResult> => {
    const hash = hashToken(presented);
    const session = await RefreshToken.findOne({ tokenHash: hash });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
    }
    if (session.revokedAt) {
        // A rotated token presented again signals possible theft: burn the
        // whole chain so every derived session stops working.
        await RefreshToken.updateMany(
            { userId: session.userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        );
        return { status: 'reused' };
    }
    const next = await issueSession(session.userId.toString());
    session.revokedAt = new Date();
    session.replacedByHash = hashToken(next.refreshToken);
    await session.save();
    return { status: 'ok', ...next, userId: session.userId.toString() };
};

export const revokeSession = async (presented: string | undefined): Promise<void> => {
    if (!presented) {
        return;
    }
    await RefreshToken.updateOne(
        { tokenHash: hashToken(presented) },
        { $set: { revokedAt: new Date() } },
    );
};
