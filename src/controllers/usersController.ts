import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction, json } from 'express';
import { User } from '../models/UserModel';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await User.find({});
        res.status(200).json({
            status: 'success',
            results: users.length,
            data: {
                users: users.map((user: any) => {
                    const { _id, fullname, email } = user;
                    return {
                        _id,
                        fullname,
                        email,
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
        // res.status(200).json(req.params.userId);
        const user = await User.findById(req.params.userId);
        res.status(200).json({
            status: 'success',
            results: user,
        });
    } catch (error) {
        next(error);
    }
};
