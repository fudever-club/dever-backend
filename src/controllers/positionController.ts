import { Request, Response, NextFunction } from 'express';
import { User } from '../models/UserModel';
import { Position } from '../models/PositionModel';
import { PRESIDENT_POSITION, VICE_PRESIDENT_POSITION } from '../middlewares/auth';

const PROTECTED_POSITIONS = new Set([PRESIDENT_POSITION, VICE_PRESIDENT_POSITION, 'MEMBER']);

export const createPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;
        if (!name?.trim() || !constant?.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên chức vụ và mã constant là bắt buộc',
            });
        }

        const normalizedConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
        const existing = await Position.findOne({ constant: normalizedConstant });
        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `Chức vụ với mã '${normalizedConstant}' đã tồn tại`,
            });
        }

        const position = await Position.create({
            name: name.trim(),
            constant: normalizedConstant,
        });

        return res.status(201).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllPositions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const positions = await Position.find({}).sort({ createdAt: 1 });

        return res.status(200).json({
            status: 'success',
            data: positions,
            length: positions?.length,
        });
    } catch (err) {
        return next(err);
    }
};

export const getPositionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const position = await Position.findById(id);
        if (!position) {
            return res.status(404).json({
                status: 'error',
                message: 'Chức vụ không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        return next(err);
    }
};

export const editPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const current = await Position.findById(id);
        if (!current) {
            return res.status(404).json({
                status: 'error',
                message: 'Chức vụ không tồn tại',
            });
        }

        if (PROTECTED_POSITIONS.has(current.constant) && constant && constant !== current.constant) {
            return res.status(403).json({
                status: 'error',
                message: `Không thể đổi mã định danh constant của chức vụ hệ thống '${current.constant}'`,
            });
        }

        const updateData: Record<string, string> = {};
        if (name?.trim()) updateData.name = name.trim();
        if (constant?.trim() && !PROTECTED_POSITIONS.has(current.constant)) {
            const nextConstant = constant.trim().toUpperCase().replace(/\s+/g, '_');
            if (nextConstant !== current.constant) {
                const existing = await Position.findOne({ constant: nextConstant, _id: { $ne: id } });
                if (existing) {
                    return res.status(409).json({
                        status: 'error',
                        message: `Chức vụ với mã '${nextConstant}' đã tồn tại`,
                    });
                }
                updateData.constant = nextConstant;
            }
        }

        const position = await Position.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        return res.status(200).json({
            status: 'success',
            data: position,
        });
    } catch (err) {
        return next(err);
    }
};

export const deletePosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const position = await Position.findById(id);
        if (!position) {
            return res.status(404).json({
                status: 'error',
                message: 'Chức vụ không tồn tại',
            });
        }

        if (PROTECTED_POSITIONS.has(position.constant)) {
            return res.status(403).json({
                status: 'error',
                message: `Chức vụ hệ thống '${position.name}' (${position.constant}) được bảo vệ và không thể xóa`,
            });
        }

        const memberCount = await User.countDocuments({ positionId: id });
        if (memberCount > 0) {
            return res.status(409).json({
                status: 'error',
                message: `Không thể xóa: Hiện có ${memberCount} thành viên đang giữ chức vụ này. Vui lòng chuyển chức vụ của thành viên trước khi xóa.`,
            });
        }

        await Position.findByIdAndDelete(id);

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa chức vụ thành công',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
};
