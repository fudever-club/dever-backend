import { Department } from './../models/DepartmentModel';
import { Request, Response, NextFunction } from 'express';

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;

        await Department.create({
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
