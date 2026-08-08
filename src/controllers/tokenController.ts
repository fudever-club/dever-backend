import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import _ from 'lodash';
const jwt = require('jsonwebtoken');
import { getJwtSecret } from '../config/auth';
import { toPrivateUserDto } from '../Utils/userDto';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = req.body;
        const { userId } = jwt.verify(token, getJwtSecret());

        const user = await User.findById({ _id: userId });

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        const responseData = toPrivateUserDto(user);

        res.status(200).json({
            status: 'success',
            data: responseData,
        });
    } catch (err) {
        next(err);
    }
};
