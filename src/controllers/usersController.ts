import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
import _ from 'lodash';
import { Leaderboard } from '../models/LeaderboardModel';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await User.find({})
            .populate('majorId')
            .populate('positionId')
            .populate('departments')
            .populate('socials.socialId');
        res.status(200).json({
            status: 'success',
            results: users.length,
            data: {
                users: users.map((user: any) => {
                    const res = _.omit(user.toObject(), ['password']);
                    return res;
                }),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('majorId')
            .populate('positionId')
            .populate('departments')
            .populate('socials.socialId');

        const leaderbaord = await Leaderboard.findOne({ userId: req.params.userId });

        const response = _.omit(user.toObject(), ['password']);

        res.status(200).json({
            status: 'success',
            data: {
                ...response,
                acSubmissionList: leaderbaord?.acSubmissionList,
            },
        });
    } catch (error) {
        console.log(error);

        next(error);
    }
};

export const getUserBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log(req.params.slug);

        const user = await User.findOne({ slug: req.params.slug })
            .populate('majorId')
            .populate('positionId')
            .populate('departments')
            .populate('socials.socialId');

        const leaderbaord = await Leaderboard.findOne({ userId: req.params.userId });

        const response = _.omit(user.toObject(), ['password']);

        res.status(200).json({
            status: 'success',
            data: {
                ...response,
                acSubmissionList: leaderbaord?.acSubmissionList,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!oldPassword || !newPassword) {
            res.status(400).json({
                status: 'error',
                message: 'Old and new passwords are required',
            });
        }
        if (newPassword.length < 6) {
            res.status(400).json({
                status: 'error',
                message: 'New password must be at least 6 characters',
            });
        }
        if (oldPassword === newPassword) {
            res.status(400).json({
                status: 'error',
                message: 'Old and new passwords must be different',
            });
        }
        if (!bcrypt.compareSync(oldPassword, user.password)) {
            res.status(400).json({
                status: 'error',
                message: 'Old password is incorrect',
            });
        }
        let passwordHashed = await bcrypt.hashSync(newPassword, 10, function (err: Error, hash: string) {
            if (err) {
                return next(err);
            } else {
                passwordHashed = hash;
                // next();
            }
        });
        const response = await User.findByIdAndUpdate(
            userId,
            { password: passwordHashed },
            { new: true, runValidator: true },
        );
        res.status(200).json({
            status: 'success',
            message: 'Change password successfully',
        });
    } catch (err) {}
};

export const editProfile = async (req: Request, res: Response, next: NextFunction) => {
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
                message: 'You are not allowed to edit this profile',
            });
        }

        const { userId: id } = req.params;

        const updateData = _.omit(req.body, ['_id', 'email']);

        const response = await User.findByIdAndUpdate(id, updateData, { new: true, runValidator: true });

        const responseData = _.omit(response.toObject(), ['password']);

        res.status(200).json({
            status: 'success',
            message: 'Edit profile successfully',
            data: responseData,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
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

        const { userId: id } = req.params;
        await User.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            message: 'Delete user successfully',
        });
    } catch (error) {
        next(error);
    }
};
