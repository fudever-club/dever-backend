import { Major } from './../models/MajorModel';
import { Request, Response, NextFunction } from 'express';

export const createMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;

        await Major.create({
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
