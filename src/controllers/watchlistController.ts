import { Watchlist } from './../models/WatchlistModel';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import axios from 'axios';

export const followOneToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, tokenId, type } = req.body;
        if (!userId || !tokenId) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'userId and followedId is required',
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
        await User.findById(userId);
        switch (type) {
            case 'follow':
                const responseFollow = await Watchlist.find({
                    userId,
                    tokenId,
                });
                if (responseFollow.length > 0) {
                    res.status(200).json({
                        status: 'fail',
                        message: 'This token has been followed before',
                    });
                } else {
                    await Watchlist.create({
                        userId,
                        tokenId,
                    });
                    res.status(200).json({
                        status: 'success',
                        message: 'Follow token success',
                    });
                }
                break;
            case 'unfollow':
                const responseUnfollow = await Watchlist.find({
                    userId,
                    tokenId,
                });
                if (responseUnfollow.length === 0) {
                    res.status(200).json({
                        status: 'fail',
                        message: 'This token has not been followed',
                    });
                } else {
                    await Watchlist.findOneAndDelete({
                        userId,
                        tokenId,
                    });
                    res.status(200).json({
                        status: 'success',
                        message: 'Unfollow token success',
                    });
                }
                break;
            default:
                res.status(200).json('Type is not found');
        }
    } catch (err) {
        return next(err);
    }
};

export const getWatchlistById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.params.userId);
        const watchlist = await Watchlist.find({ userId: user._id });
        const followedTokenId = watchlist.map((token: any) => +token.tokenId);
        const tokenList = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
            headers: {
                'X-CMC_PRO_API_KEY': `${process.env.API_KEY}`,
            },
        });
        const followedToken = tokenList.data.data.filter((token: any) => followedTokenId.includes(token.id));
        res.status(200).json({
            status: 'success',
            results: {
                length: followedToken.length,
                data: followedToken,
            },
        });
    } catch (error) {
        console.log(error);

        next(error);
    }
};
