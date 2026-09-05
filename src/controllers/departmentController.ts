import { Request, Response, NextFunction } from 'express';
import { Department } from '../models/DepartmentModel';
import { User } from '../models/UserModel';

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;
        if (!name?.trim() || !constant?.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên ban và mã constant là bắt buộc',
            });
        }

        const normalizedConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
        const existing = await Department.findOne({ constant: normalizedConstant });
        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `Ban với mã '${normalizedConstant}' đã tồn tại`,
            });
        }

        const department = await Department.create({
            name: name.trim(),
            constant: normalizedConstant,
        });

        return res.status(201).json({
            status: 'success',
            data: department,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await Department.find({}).sort({ createdAt: 1 });
        return res.status(200).json({
            status: 'success',
            data: departments,
            length: departments?.length,
        });
    } catch (err) {
        return next(err);
    }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({
                status: 'error',
                message: 'Ban chuyên môn không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: department,
        });
    } catch (err) {
        return next(err);
    }
};

export const editDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const current = await Department.findById(id);
        if (!current) {
            return res.status(404).json({
                status: 'error',
                message: 'Ban chuyên môn không tồn tại',
            });
        }

        const updateData: Record<string, string> = {};
        if (name?.trim()) updateData.name = name.trim();
        if (constant?.trim()) {
            const nextConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
            if (nextConstant !== current.constant) {
                const existing = await Department.findOne({ constant: nextConstant, _id: { $ne: id } });
                if (existing) {
                    return res.status(409).json({
                        status: 'error',
                        message: `Ban với mã '${nextConstant}' đã tồn tại`,
                    });
                }
                updateData.constant = nextConstant;
            }
        }

        const department = await Department.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        return res.status(200).json({
            status: 'success',
            data: department,
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({
                status: 'error',
                message: 'Ban chuyên môn không tồn tại',
            });
        }

        const memberCount = await User.countDocuments({ departments: id });
        if (memberCount > 0) {
            return res.status(409).json({
                status: 'error',
                message: `Không thể xóa: Hiện có ${memberCount} thành viên đang thuộc ban này.`,
            });
        }

        await Department.findByIdAndDelete(id);

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa ban chuyên môn thành công',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};
