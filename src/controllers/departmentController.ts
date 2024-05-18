import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Department } from './../models/DepartmentModel';

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

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
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

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
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

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
