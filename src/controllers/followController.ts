import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { Follow } from '../models/FollowModel';
import { User } from '../models/UserModel';

export const followOneUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, followedId, type } = req.body;
        if (!userId || !followedId) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'userId or followedId is required',
                },
            });
        }
        if (!type) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'type is required',
                },
            });
        }
        if (userId === followedId) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'You cannot follow yourself',
                },
            });
        }
        await User.findById(userId);
        await User.findById(followedId);
        const follow = {
            userId,
            followedId,
        };
        switch (type) {
            case 'follow':
                const responseFollow = await Follow.find({
                    userId,
                    followedId,
                });
                if (responseFollow.length > 0) {
                    res.status(200).json({
                        status: 'success',
                        message: 'They have been followed before',
                    });
                } else {
                    await Follow.create(follow);
                    res.status(200).json({
                        status: 'success',
                        message: 'Follow success',
                    });
                }
                break;
            case 'unfollow':
                const responseUnfollow = await Follow.find({
                    userId,
                    followedId,
                });
                if (responseUnfollow.length === 0) {
                    res.status(200).json({
                        status: 'success',
                        message: 'They have not been followed',
                    });
                } else {
                    await Follow.findOneAndDelete({
                        userId,
                        followedId,
                    });
                    res.status(200).json({
                        status: 'success',
                        message: 'Unfollow success',
                    });
                }
                break;
            default:
                res.status(200).json('type is not found');
        }
    } catch (err) {
        return next(err);
    }
};
