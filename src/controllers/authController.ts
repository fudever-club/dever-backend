import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = {
            ...req.body,
            avatar: 'http://res.cloudinary.com/de41uvd76/image/upload/v1672120944/vojnvhtyfxmhssupfnok.png',
        };
        await User.create(user);
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
        if (bcrypt.compareSync(req.body.password, user.password)) {
            const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
            const { _id, firstname, lastname, email, avatar, bio } = user;
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
            message: 'Welcome to the API',
        });
    } catch (error) {
        next(error);
    }
};
