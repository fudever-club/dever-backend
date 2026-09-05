import { Request, Response, NextFunction } from 'express';
import { Project } from '../models/ProjectModel';

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await Project.create({
            ...req.body,
        });

        return res.status(201).json({
            status: 'success',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};

export const getAllProject = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await Project.find({}).sort({ createdAt: -1 });

        return res.status(200).json({
            status: 'success',
            results: projects.length,
            data: projects,
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });

        if (!project) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy dự án',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};

export const editProjectById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
        };

        const project = await Project.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!project) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy dự án để cập nhật',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Cập nhật dự án thành công',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteProjectById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const project = await Project.findByIdAndDelete(id);

        if (!project) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy dự án để xóa',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Xóa dự án thành công',
            data: null,
        });
    } catch (error) {
        return next(error);
    }
};
