import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Project } from '../models/ProjectModel';

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
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

        const project = await Project.create({
            ...req.body,
        });

        res.status(200).json({
            status: 'success',
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const getAllProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await Project.find({});

        res.status(200).json({
            status: 'success',
            data: projects,
        });
    } catch (error) {
        next(error);
    }
};

export const getProjectBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });

        if (!project) {
            res.status(500).json({
                status: `Can't found project`,
            });
        }

        res.status(200).json({
            status: 'success',
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const editProjectById = async (req: Request, res: Response, next: NextFunction) => {
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
                message: 'You are not allowed to edit this profile',
            });
        }

        const { id } = req.params;

        const updateData = {
            ...req.body,
        };

        const response = await Project.findByIdAndUpdate(id, updateData, { new: true, runValidator: true });

        res.status(200).json({
            status: 'success',
            message: 'Edit project successfully',
            data: response,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteProjectById = async (req: Request, res: Response, next: NextFunction) => {
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
        await Project.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            message: 'Delete project successfully',
        });
    } catch (error) {
        next(error);
    }
};
