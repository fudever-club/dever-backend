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

export const getAllPositions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const positions = await Position.find({});
        console.log(positions);

        res.status(200).json({
            status: 'success',
            data: positions,
            length: positions?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getPositionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const position = await Position.findById(id);

        res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        next(err);
    }
};

export const editPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const position = await Position.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        next(err);
    }
};

export const deletePosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await Position.findByIdAndDelete(id);

        res.status(204).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
