import { NextFunction, Request, Response } from 'express';
import { Alumni } from '../models/AlumniModel';

const editableFields = ['name', 'graduationGen', 'headline', 'bio', 'workplace', 'avatar', 'profileUrl', 'isPublished'] as const;

const input = (body: Record<string, unknown>) =>
    editableFields.reduce((value, field) => {
        if (body[field] !== undefined) value[field] = body[field];
        return value;
    }, {} as Record<(typeof editableFields)[number], unknown>);

export const listAlumni = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const filter = res.locals.auth?.isAdmin ? {} : { isPublished: true };
        const alumni = await Alumni.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({ status: 'success', data: alumni });
    } catch (error) {
        return next(error);
    }
};

export const createAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.create(input(req.body || {}));
        return res.status(201).json({ status: 'success', data: alumnus });
    } catch (error) {
        return next(error);
    }
};

export const updateAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.findByIdAndUpdate(req.params.id, input(req.body || {}), {
            new: true,
            runValidators: true,
        });
        if (!alumnus) return res.status(404).json({ status: 'error', message: 'Alumni item not found' });
        return res.status(200).json({ status: 'success', data: alumnus });
    } catch (error) {
        return next(error);
    }
};

export const deleteAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.findByIdAndDelete(req.params.id);
        if (!alumnus) return res.status(404).json({ status: 'error', message: 'Alumni item not found' });
        return res.status(200).json({ status: 'success', message: 'Alumni item deleted' });
    } catch (error) {
        return next(error);
    }
};
