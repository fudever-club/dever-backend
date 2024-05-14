import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import _ from 'lodash';
const jwt = require('jsonwebtoken');

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = req.body;

        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById({ _id: userId });

        const responseData = _.omit(user.toObject(), ['password']);

        res.status(200).json({
            status: 'success',
            data: responseData,
        });
    } catch (err) {
        next(err);
    }
};
