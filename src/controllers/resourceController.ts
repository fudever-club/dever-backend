import { Request, Response, NextFunction } from 'express';
import { Resource } from '../models/ResourceModel';

export const getAllResources = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resources = await Resource.find().sort({ createdAt: -1 });
        res.status(200).json({
            status: 'success',
            results: resources.length,
            data: resources,
        });
    } catch (error) {
        next(error);
    }
};

export const createResource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resource = await Resource.create(req.body);
        res.status(201).json({
            status: 'success',
            data: resource,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteResource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await Resource.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: 'success',
            message: 'Resource deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
