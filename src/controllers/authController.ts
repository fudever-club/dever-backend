import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const email = req.body.email;

        const userExist = await User.findOne({ email });

        if (userExist) {
            const err: ErrorType = new Error('User already exist');
            err.status = 400;
            return next(err);
        }

        let user: any;
        // const user = new User({
        //     ...req.body,
        //     avatar:
        //         req.body?.avatar ??
        //         'https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp',
        // });

        user = await new User({
            ...req.body,
            avatar:
                req.body?.avatar ??
                'https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp',
        });
        await user.save();

        // await bcrypt.hash(req.body.password, 10, async function (err: Error, hash: string) {
        //     console.log('🚀 ~ req.body.password:', req.body.password);
        //     if (err) {
        //         console.log('🚀 ~ err:', err);
        //         return next(err);
        //     } else {
        //         user = await User.create({
        //             ...req.body,
        //             password: hash,
        //             avatar:
        //                 req.body?.avatar ??
        //                 'https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp',
        //         });

        //         console.log('🚀 ~ user:', user);
        //     }
        // });

        res.status(200).json({
            status: 'success',
            data: {
                user,
            },
        });
    } catch (err) {
        next(err);
    }
};
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            const err: ErrorType = new Error('Email or Password is not correct');
            err.status = 400;
            return next(err);
        }

        console.log('🚀 ~ login ~ req.body.password:', req.body.password);
        console.log('🚀 ~ login ~ user.password:', user.password);

        if (bcrypt.compareSync(req.body.password, user.password)) {
            const token = jwt.sign({ userId: user._id, isAdmin: user?.isAdmin }, process.env.APP_SECRET, {
                expiresIn: '7d',
            });
            const { _id, firstname, lastname, email, avatar, bio, isAdmin } = user;
            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        _id,
                        firstname,
                        lastname,
                        email,
                        avatar,
                        bio,
                        isAdmin,
                    },
                    token,
                },
            });
        } else {
            const err: ErrorType = new Error('Email or Password is not correct');
            err.status = 400;
            return next(err);
        }
    } catch (error) {}
};

export const welcome = (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json({
            status: 'success',
            message: 'Welcome to the FU-DEVER',
        });
    } catch (error) {
        next(error);
    }
};

export const lowercaseEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('-----');

        const users = await User.find({});
        const updatePromises = users.map(async (user: any) => {
            if (user.email) {
                user.email = user.email.toLowerCase();
                console.log(user);

                await user.save();
            }
        });
        await Promise.all(updatePromises);
        res.status(200).json({
            status: 'success',
            message: 'Lowercase email successfully',
        });
    } catch (error) {
        next(error);
    }
};
