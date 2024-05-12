import { Position } from './../models/PositionModel';
import { Request, Response, NextFunction } from 'express';

export const createPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;

        await Position.create({
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
