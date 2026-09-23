import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import { getJwtSecret } from '../config/auth';
import {
    REFRESH_COOKIE,
    clearAuthCookies,
    issueSession,
    revokeSession,
    rotateSession,
    setAuthCookies,
} from '../Utils/session';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Kept only for import compatibility. Account provisioning is exclusively
 * handled by the admin-only users endpoints, so this legacy handler must not
 * regain a request-body account-creation path.
 */
export const register = (_req: Request, _res: Response, next: NextFunction) => {
    const error: ErrorType = new Error('Public registration has been retired');
    error.status = 410;
    return next(error);
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const inputEmail = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const safeEmail = escapeRegExp(inputEmail);
        const user = await User.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } })
            .select('+password')
            .populate('positionId');
        if (!user || !password || !bcrypt.compareSync(password, user.password)) {
            const err: ErrorType = new Error('Email hoặc Mật khẩu không chính xác');
            err.status = 400;
            return next(err);
        }

        const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '7d' });
        // Cookie session alongside the legacy body token so browser clients can
        // migrate to httpOnly storage without breaking existing integrations.
        const session = await issueSession(user._id.toString());
        setAuthCookies(req, res, { access: token, refresh: session.refreshToken });
        const { _id, firstname, lastname, email, avatar, description, isAdmin, isLeader, positionId } = user;
        return res.status(200).json({
            status: 'success',
            data: {
                user: { _id, firstname, lastname, email, avatar, description, isAdmin, isLeader, positionId },
                token,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const welcome = (_req: Request, res: Response) =>
    res.status(200).json({ status: 'success', message: 'Welcome to the FU-DEVER' });

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const presented =
            ((req.cookies as any)?.[REFRESH_COOKIE] as string) ||
            (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '');
        if (!presented) {
            return res.status(401).json({ status: 'error', message: 'Refresh token required' });
        }
        const result = await rotateSession(presented);
        if (result.status !== 'ok') {
            clearAuthCookies(req, res);
            return res.status(401).json({ status: 'error', message: 'Session expired, please sign in again' });
        }
        setAuthCookies(req, res, { access: result.accessToken, refresh: result.refreshToken });
        return res.status(200).json({ status: 'success', data: { token: result.accessToken } });
    } catch (error) {
        return next(error);
    }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await revokeSession((req.cookies as any)?.[REFRESH_COOKIE] as string | undefined);
        clearAuthCookies(req, res);
        return res.status(200).json({ status: 'success', message: 'Signed out' });
    } catch (error) {
        return next(error);
    }
};

// Kept for compatibility with existing imports; intentionally no longer exposed by a route.
export const lowercaseEmail = async (_req: Request, _res: Response, next: NextFunction) => {
    const error: ErrorType = new Error('This maintenance action is disabled');
    error.status = 410;
    return next(error);
};
