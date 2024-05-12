import { Social } from './../models/SocialModel';
import { Request, Response, NextFunction } from 'express';

export const createSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;

        await Social.create({
            name,
            constant,
        });
        res.status(200).json({
            status: 'success',
            data: {
                name,
                constant,
            },
        });
    } catch (err) {
        next(err);
    }
};
