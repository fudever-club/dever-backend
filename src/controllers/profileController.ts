import { NextFunction, Request, Response } from 'express';
import { User } from '../models/UserModel';
import { DEFAULT_PROFILE_VISIBILITY, toPrivateUserDto } from '../Utils/userDto';

const bcrypt = require('bcryptjs');

const SELF_EDITABLE_FIELDS = new Set([
    'avatar',
    'nickname',
    'phone',
    'firstname',
    'lastname',
    'description',
    'dob',
    'hometown',
    'job',
    'workplace',
    'school',
    'majorId',
    'gen',
    'MSSV',
    'socials',
    'skills',
    'favourites',
]);

const VISIBILITY_FIELDS = Object.keys(DEFAULT_PROFILE_VISIBILITY);

const profileUpdate = (body: Record<string, unknown>) => {
    const update: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(body)) {
        if (SELF_EDITABLE_FIELDS.has(field)) {
            update[field] = value;
        }
    }

    if (body.profileVisibility && typeof body.profileVisibility === 'object' && !Array.isArray(body.profileVisibility)) {
        const requested = body.profileVisibility as Record<string, unknown>;
        update.profileVisibility = VISIBILITY_FIELDS.reduce((visibility, field) => {
            visibility[field] = requested[field] === true;
            return visibility;
        }, {} as Record<string, boolean>);
    }

    return update;
};

export const editProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication is required' });
        }
        const update = profileUpdate(req.body || {});
        const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true })
            .populate('departments')
            .populate('socials.socialId');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            data: toPrivateUserDto(user),
        });
    } catch (error) {
        return next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const { oldPassword, newPassword } = req.body || {};
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication is required' });
        }
        if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ status: 'error', message: 'Old and new passwords are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
        }
        if (oldPassword === newPassword) {
            return res.status(400).json({ status: 'error', message: 'New password must be different' });
        }

        const user = await User.findById(userId);
        if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
            return res.status(400).json({ status: 'error', message: 'Old password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        return res.status(200).json({ status: 'success', message: 'Password changed successfully' });
    } catch (error) {
        return next(error);
    }
};
