import { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getJwtSecret } from '../config/auth';
import { RefreshToken } from '../models/RefreshTokenModel';
import { User } from '../models/UserModel';

const jwt = require('jsonwebtoken');

/** Cookie names are distinct from legacy JS-readable storage keys on purpose. */
export const ACCESS_COOKIE = 'dever_at';
export const REFRESH_COOKIE = 'dever_rt';

/** Access lives 1h; the 30d refresh rotation is the long-lived credential.
 *  Frontends already silent-refresh on 401, so the shorter window is
 *  seamless for cookie clients. Legacy body-token integrations must
 *  refresh (or re-login) hourly instead of weekly. */
export const ACCESS_TTL_MS = 60 * 60 * 1000;
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
    tokenVersion = 0,
): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = jwt.sign({ userId, v: tokenVersion }, getJwtSecret(), { expiresIn: '1h' });
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
    // Mint with the user's CURRENT version (never a hardcoded default) and
    // refuse chains of deleted accounts instead of minting for ghosts.
    const owner = await User.findById(session.userId).select('tokenVersion');
    if (!owner) {
        await RefreshToken.updateMany(
            { userId: session.userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        );
        return { status: 'invalid' };
    }
    const next = await issueSession(session.userId.toString(), (owner as any).tokenVersion ?? 0);
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

/** Revoke every refresh chain of a user (logout-all-devices, password
 *  reset, admin ban). Access JWTs are killed separately by the tokenVersion
 *  bump checked in auth middleware — this call handles the refresh side. */
export const revokeAllSessions = async (userId: string): Promise<number> => {
    const result = await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    ).exec();
    return (result as unknown as { modifiedCount?: number }).modifiedCount ?? 0;
};
