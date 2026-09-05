import { Request, Response, NextFunction } from 'express';
import { ImageActivity } from '../models/imageActivityModel';

export const insertNewImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const image = await ImageActivity.create({
            ...req.body,
        });

        return res.status(201).json({
            status: 'success',
            data: {
                image,
            },
        });
    } catch (err) {
        return next(err);
    }
};

export const insertManyImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const images = req.body;
        if (!Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Danh sách ảnh không hợp lệ',
            });
        }

        const inserted = await ImageActivity.insertMany(images);

        return res.status(201).json({
            status: 'success',
            results: inserted.length,
            data: {
                images: inserted,
            },
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllImages = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const images = await ImageActivity.find({}).sort({ createdAt: -1 });

        return res.status(200).json({
            status: 'success',
            results: images.length,
            data: {
                images,
            },
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const deleted = await ImageActivity.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                status: 'error',
                message: 'Ảnh hoạt động không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa ảnh thành công',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteManyImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Danh sách id cần xóa không hợp lệ',
            });
        }

        const result = await ImageActivity.deleteMany({ _id: { $in: ids } });

        return res.status(200).json({
            status: 'success',
            message: `Đã xóa ${result.deletedCount} ảnh hoạt động`,
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};
