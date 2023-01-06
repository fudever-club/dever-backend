import { Follow } from './../models/FollowModel';
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
            bio: '',
            avatar: 'http://res.cloudinary.com/de41uvd76/image/upload/v1672120944/vojnvhtyfxmhssupfnok.png',
        };
        console.log(user);

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
        const followingList = await Follow.find({ userId: user._id });
        const followerList = await Follow.find({ followedId: user._id });
        if (bcrypt.compareSync(req.body.password, user.password)) {
            const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
            const { _id, fullname, email, avatar, bio } = user;
            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        _id,
                        fullname,
                        email,
                        avatar,
                        bio,
                        following: followingList.map((item: any) => item.followedId),
                        follower: followerList.map((item: any) => item.userId),
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
