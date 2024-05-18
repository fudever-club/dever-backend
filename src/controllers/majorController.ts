import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Major } from './../models/MajorModel';

export const createMajor = async (req: Request, res: Response, next: NextFunction) => {
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

        await Major.create({
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

export const getAllMajors = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const majors = await Major.find({});

        res.status(200).json({
            status: 'success',
            data: majors,
            length: majors?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getMajorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const major = await Major.findById(id);

        res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        next(err);
    }
};

export const editMajor = async (req: Request, res: Response, next: NextFunction) => {
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

        const major = await Major.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteMajor = async (req: Request, res: Response, next: NextFunction) => {
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
        await Major.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
