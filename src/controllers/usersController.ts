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
                    const { _id, avatar, fullname, email } = user;
                    return {
                        _id,
                        fullname,
                        email,
                        avatar,
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
        const { fullname, email, bio, avatar } = user;
        res.status(200).json({
            status: 'success',
            results: { fullname, email, bio, avatar },
        });
    } catch (error) {
        next(error);
    }
};

export const editProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;
        const response = await User.findByIdAndUpdate(userId, req.body, { new: true, runValidator: true });
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};
