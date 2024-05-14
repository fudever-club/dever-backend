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

export const getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await Department.find({});
        res.status(200).json({
            status: 'success',
            data: departments,
            length: departments?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const department = await Department.findById(id);

        res.status(200).json({
            status: 'success',
            data: department,
        });
    } catch (err) {
        next(err);
    }
};

export const editDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const department = await Department.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: department,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await Department.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            message: 'Department deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};
