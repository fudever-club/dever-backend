import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import _ from 'lodash';
const jwt = require('jsonwebtoken');
import { getJwtSecret } from '../config/auth';
import { toPrivateUserDto } from '../Utils/userDto';
import { Position } from '../models/PositionModel';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Prefer the Authorization header (consistent with the auth middleware);
        // retain the legacy body token only as a fallback.
        const header = req.header('authorization');
        const headerToken =
            header && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
        const token = headerToken || req.body?.token;
        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token is required' });
        }
        const { userId } = jwt.verify(token, getJwtSecret());

        const user = await User.findById({ _id: userId }).populate({ path: 'positionId', model: Position });

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        const responseData = toPrivateUserDto(user);

        // Account data must never be stored by shared or downstream caches.
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
            status: 'success',
            data: responseData,
        });
    } catch (err) {
        next(err);
    }
};
