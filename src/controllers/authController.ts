import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const jwt = require('jsonwebtoken');
const emailvalidator = require('email-validator');
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
        res.json('User registered');
    } catch (err) {
        next(err);
    }
};
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            const err: ErrorType = new Error('Email is not valid');
            err.status = 400;
            return next(err);
        }

        if (bcrypt.compareSync(req.body.password, user.password)) {
            const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
            const { fullname, email, avatar } = user;
            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        fullname,
                        email,
                        avatar,
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
