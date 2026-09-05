import { Request, Response, NextFunction } from 'express';
import { Major } from '../models/MajorModel';
import { User } from '../models/UserModel';

export const createMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;
        if (!name?.trim() || !constant?.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên chuyên ngành và mã constant là bắt buộc',
            });
        }

        const normalizedConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
        const existing = await Major.findOne({ constant: normalizedConstant });
        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `Chuyên ngành với mã '${normalizedConstant}' đã tồn tại`,
            });
        }

        const major = await Major.create({
            name: name.trim(),
            constant: normalizedConstant,
        });

        return res.status(201).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllMajors = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const majors = await Major.find({}).sort({ createdAt: 1 });
        return res.status(200).json({
            status: 'success',
            data: majors,
            length: majors?.length,
        });
    } catch (err) {
        return next(err);
    }
};

export const getMajorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const major = await Major.findById(id);
        if (!major) {
            return res.status(404).json({
                status: 'error',
                message: 'Chuyên ngành không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        return next(err);
    }
};

export const editMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const current = await Major.findById(id);
        if (!current) {
            return res.status(404).json({
                status: 'error',
                message: 'Chuyên ngành không tồn tại',
            });
        }

        const updateData: Record<string, string> = {};
        if (name?.trim()) updateData.name = name.trim();
        if (constant?.trim()) {
            const nextConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
            if (nextConstant !== current.constant) {
                const existing = await Major.findOne({ constant: nextConstant, _id: { $ne: id } });
                if (existing) {
                    return res.status(409).json({
                        status: 'error',
                        message: `Chuyên ngành với mã '${nextConstant}' đã tồn tại`,
                    });
                }
                updateData.constant = nextConstant;
            }
        }

        const major = await Major.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        return res.status(200).json({
            status: 'success',
            data: major,
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteMajor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const major = await Major.findById(id);
        if (!major) {
            return res.status(404).json({
                status: 'error',
                message: 'Chuyên ngành không tồn tại',
            });
        }

        const memberCount = await User.countDocuments({ majorId: id });
        if (memberCount > 0) {
            return res.status(409).json({
                status: 'error',
                message: `Không thể xóa: Hiện có ${memberCount} thành viên đang theo học chuyên ngành này.`,
            });
        }

        await Major.findByIdAndDelete(id);

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa chuyên ngành thành công',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};
