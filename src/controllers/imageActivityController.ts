import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { ImageActivity } from '../models/imageActivityModel';

export const insertNewImage = async (req: Request, res: Response, next: NextFunction) => {
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

        const image = {
            ...req.body,
        };
        await ImageActivity.create(image);
        res.status(200).json({
            status: 'success',
            data: {
                image,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const insertManyImages = async (req: Request, res: Response, next: NextFunction) => {
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

        const images = req.body;
        await ImageActivity.insertMany(images);
        res.status(200).json({
            status: 'success',
            data: {
                images,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getAllImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const images = await ImageActivity.find({});
        res.status(200).json({
            status: 'success',
            data: {
                images,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
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
        await ImageActivity.findByIdAndDelete(id);
        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteManyImages = async (req: Request, res: Response, next: NextFunction) => {
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

        const { ids } = req.body;
        await ImageActivity.deleteMany({ _id: { $in: ids } });
        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
