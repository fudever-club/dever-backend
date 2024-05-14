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

export const getAllMajors = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const majors = await Major.find({});
        console.log(majors);

        res.status(200).json({
            status: 'success',
            data: majors,
            length: majors?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getMajorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const major = await Major.findById(id);

        res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        next(err);
    }
};

export const editMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const major = await Major.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await Major.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
