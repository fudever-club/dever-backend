import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Position } from './../models/PositionModel';

export const createPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { name, constant } = req.body;

        await Position.create({
            name,
            constant,
        });
        res.status(200).json({
            status: 'success',
            data: {
                name,
                constant,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getAllPositions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const positions = await Position.find({});
        console.log(positions);

        res.status(200).json({
            status: 'success',
            data: positions,
            length: positions?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getPositionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const position = await Position.findById(id);

        res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        next(err);
    }
};

export const editPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { id } = req.params;
        const { name, constant } = req.body;

        const position = await Position.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        next(err);
    }
};

export const deletePosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { id } = req.params;
        await Position.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
