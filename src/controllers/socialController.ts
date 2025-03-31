import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Social } from './../models/SocialModel';

export const createSocial = async (req: Request, res: Response, next: NextFunction) => {
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

        await Social.create({
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

export const getAllSocials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const socials = await Social.find({});

        res.status(200).json({
            status: 'success',
            data: socials,
            length: socials?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getSocialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const social = await Social.findById(id);

        res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        next(err);
    }
};

export const editSocial = async (req: Request, res: Response, next: NextFunction) => {
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

        const social = await Social.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteSocial = async (req: Request, res: Response, next: NextFunction) => {
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
        await Social.findByIdAndDelete(id);
        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
