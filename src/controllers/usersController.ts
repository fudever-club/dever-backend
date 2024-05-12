import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
const bcrypt = require('bcryptjs');
import _ from 'lodash';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await User.find({});
        res.status(200).json({
            status: 'success',
            results: users.length,
            data: {
                users: users.map((user: any) => {
                    const { _id, avatar, firstname, lastname, positionId, dateJoin } = user;
                    return {
                        _id,
                        avatar,
                        firstname,
                        lastname,
                        positionId,
                        dateJoin,
                    };
                }),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.params.userId).populate('majorId').populate('positionId');

        const response = _.omit(user.toObject(), ['password']);

        res.status(200).json({
            status: 'success',
            data: {
                ...response,
            },
        });
    } catch (error) {
        console.log(error);

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
        const { userId } = req.params;
        const response = await User.findByIdAndUpdate(userId, req.body, { new: true, runValidator: true });

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
