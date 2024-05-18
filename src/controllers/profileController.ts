import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import _ from 'lodash';
const jwt = require('jsonwebtoken');

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

        const updateData = _.omit(req.body, ['_id', 'email', 'positionId', 'isAdmin', 'isExcellent']);

        const response = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidator: true }).populate(
            'departments',
        );

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
