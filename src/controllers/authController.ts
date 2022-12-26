import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const jwt = require('jsonwebtoken');
const emailvalidator = require('email-validator');

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (emailvalidator.validate(req.body.email)) {
            const user = await User.create({
                fullname: req.body.fullname,
                email: req.body.email,
                password: req.body.password,
            });
            res.status(200).json({
                status: '200',
                data: {
                    user,
                },
            });
        } else {
            res.status(400).send('Invalid Email');
        }
    } catch (err) {
        next(err);
    }



    if (bcrypt.compareSync(req.body.password, user.password)) {
      const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
      const { fullname, email } = user;


export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            const err: ErrorType = new Error('Email is not valid');
            err.status = 400;
            return next(err);
        }
        if (req.body.password === user.password) {
            const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
            const { fullname, email } = user;

            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        fullname,
                        email,
                    },
                    token,
                },
            });
        } else {
            const err: ErrorType = new Error('Password is not correct');
            err.status = 400;
            return next(err);
        }
    } catch (error) {}
};
