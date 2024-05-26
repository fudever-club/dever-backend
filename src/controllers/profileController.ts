import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import _ from 'lodash';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

        const updateData = _.omit(req.body, [
            '_id',
            'email',
            'positionId',
            'isAdmin',
            'isExcellent',
            'departments',
            '',
        ]);

        const response = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidator: true })
            .populate('departments')
            .populate('socials.socialId');

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

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
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

        const { oldPassword, newPassword } = req.body;

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
    } catch (error) {
        next(error);
    }
};
