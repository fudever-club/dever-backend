import { NextFunction, Request, Response } from 'express';
import { ProjectLab } from '../models/ProjectLabModel';

const editableFields = ['title', 'summary', 'category', 'status', 'roles', 'contactUrl', 'coverImage'] as const;

const input = (body: Record<string, unknown>) =>
    editableFields.reduce((value, field) => {
        if (body[field] !== undefined) value[field] = body[field];
        return value;
    }, {} as Record<(typeof editableFields)[number], unknown>);

export const listProjectLabs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await ProjectLab.find({ status: { $ne: 'closed' } }).sort({ createdAt: -1 });
        return res.status(200).json({ status: 'success', data: projects });
    } catch (error) {
        return next(error);
    }
};

export const createProjectLab = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await ProjectLab.create(input(req.body || {}));
        return res.status(201).json({ status: 'success', data: project });
    } catch (error) {
        return next(error);
    }
};

export const updateProjectLab = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await ProjectLab.findByIdAndUpdate(req.params.id, input(req.body || {}), {
            new: true,
            runValidators: true,
        });
        if (!project) return res.status(404).json({ status: 'error', message: 'Project Lab item not found' });
        return res.status(200).json({ status: 'success', data: project });
    } catch (error) {
        return next(error);
    }
};

export const deleteProjectLab = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await ProjectLab.findByIdAndDelete(req.params.id);
        if (!project) return res.status(404).json({ status: 'error', message: 'Project Lab item not found' });
        return res.status(200).json({ status: 'success', message: 'Project Lab item deleted' });
    } catch (error) {
        return next(error);
    }
};
