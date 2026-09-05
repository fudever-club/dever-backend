import { Request, Response, NextFunction } from 'express';
import { Social } from '../models/SocialModel';

export const createSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;
        if (!name?.trim() || !constant?.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên nền tảng mạng xã hội và mã constant là bắt buộc',
            });
        }

        const normalizedConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
        const existing = await Social.findOne({ constant: normalizedConstant });
        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `Mạng xã hội với mã '${normalizedConstant}' đã tồn tại`,
            });
        }

        const social = await Social.create({
            name: name.trim(),
            constant: normalizedConstant,
        });

        return res.status(201).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllSocials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const socials = await Social.find({}).sort({ createdAt: 1 });
        return res.status(200).json({
            status: 'success',
            data: socials,
            length: socials?.length,
        });
    } catch (err) {
        return next(err);
    }
};

export const getSocialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const social = await Social.findById(id);
        if (!social) {
            return res.status(404).json({
                status: 'error',
                message: 'Mạng xã hội không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        return next(err);
    }
};

export const editSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const current = await Social.findById(id);
        if (!current) {
            return res.status(404).json({
                status: 'error',
                message: 'Mạng xã hội không tồn tại',
            });
        }

        const updateData: Record<string, string> = {};
        if (name?.trim()) updateData.name = name.trim();
        if (constant?.trim()) {
            const nextConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
            if (nextConstant !== current.constant) {
                const existing = await Social.findOne({ constant: nextConstant, _id: { $ne: id } });
                if (existing) {
                    return res.status(409).json({
                        status: 'error',
                        message: `Mạng xã hội với mã '${nextConstant}' đã tồn tại`,
                    });
                }
                updateData.constant = nextConstant;
            }
        }

        const social = await Social.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        return res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const social = await Social.findById(id);
        if (!social) {
            return res.status(404).json({
                status: 'error',
                message: 'Mạng xã hội không tồn tại',
            });
        }

        await Social.findByIdAndDelete(id);

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa mạng xã hội thành công',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};
