import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { Follow } from '../models/FollowModel';
import { User } from '../models/UserModel';

export const followOneUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, followedId, type } = req.body;
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
                        status: 'They have been followed before',
                    });
                } else {
                    await Follow.create(follow);
                    res.status(200).json({
                        status: 'Follow success',
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
                        status: 'They have not been followed',
                    });
                } else {
                    await Follow.findOneAndDelete({
                        userId,
                        followedId,
                    });
                    res.status(200).json('Unfollow success');
                }
                break;
            default:
                res.status(200).json('type is not found');
        }
    } catch (err) {
        return next(err);
    }
};
