import { NextFunction, Request, Response } from 'express';
import { getJwtSecret } from '../config/auth';
import { User } from '../models/UserModel';
import { Position } from '../models/PositionModel';

const jwt = require('jsonwebtoken');

export const PRESIDENT_POSITION = 'CHUNHIEM';
export const VICE_PRESIDENT_POSITION = 'PHOCHUNHIEM';

export interface AuthContext {
    userId: string;
    isAdmin: boolean;
    positionConstant: string | null;
}

const unauthorized = (res: Response, message = 'Authentication is required') =>
    res.status(401).json({
        status: 'error',
        message,
    });

const parseBearerToken = (req: Request): string | null => {
    const authorization = req.header('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
};

const authenticate = async (req: Request): Promise<AuthContext | null> => {
    const token = parseBearerToken(req);
    if (!token) {
        return null;
    }

    const payload = jwt.verify(token, getJwtSecret()) as { userId?: string };
    if (!payload.userId) {
        return null;
    }

    // Do not trust roles embedded in a long-lived token. The current access
    // flag and organization title are always read from MongoDB.
    const user = await User.findById(payload.userId)
        .select('_id isAdmin positionId')
        .populate({ path: 'positionId', model: Position, select: 'constant' });
    if (!user) {
        return null;
    }

    return {
        userId: user._id.toString(),
        isAdmin: Boolean(user.isAdmin),
        positionConstant: (user.positionId as any)?.constant || null,
    };
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return unauthorized(res);
        }

        res.locals.auth = auth;
        return next();
    } catch (error: any) {
        if (error?.status === 500) {
            return next(error);
        }
        return unauthorized(res, 'Your session is invalid or has expired');
    }
};

/** Attach a valid identity when supplied, while retaining anonymous public reads. */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.header('authorization')) {
        return next();
    }

    return requireAuth(req, res, next);
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as AuthContext | undefined;
    if (!auth?.isAdmin) {
        return res.status(403).json({
            status: 'error',
            message: 'Administrator access is required',
        });
    }

    return next();
};

export const requirePresident = (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as AuthContext | undefined;
    if (!auth?.isAdmin || auth.positionConstant !== PRESIDENT_POSITION) {
        return res.status(403).json({
            status: 'error',
            message: 'President access is required',
        });
    }

    return next();
};
