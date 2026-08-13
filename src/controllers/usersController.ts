import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { User } from '../models/UserModel';
import { Leaderboard } from '../models/LeaderboardModel';
import { Position } from '../models/PositionModel';
import { DEFAULT_PROFILE_VISIBILITY, toPrivateUserDto, toPublicProfileKey, toPublicUserDto } from '../Utils/userDto';
import { PRESIDENT_POSITION, VICE_PRESIDENT_POSITION } from '../middlewares/auth';

const bcrypt = require('bcryptjs');

type ProvisioningInput = {
    email?: unknown;
    firstname?: unknown;
    lastname?: unknown;
    phone?: unknown;
    mssv?: unknown;
    MSSV?: unknown;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const makeTemporaryPassword = () => randomBytes(18).toString('base64url');

const memberInput = (input: ProvisioningInput) => ({
    email: text(input.email).toLowerCase(),
    firstname: text(input.firstname),
    lastname: text(input.lastname),
    phone: text(input.phone) || null,
    MSSV: text(input.mssv || input.MSSV) || null,
});

const provisionMember = async (input: ProvisioningInput) => {
    const member = memberInput(input);
    if (!member.email || !member.firstname || !member.lastname) {
        return { error: 'email, firstname and lastname are required' };
    }

    const exists = await User.findOne({ email: member.email }).select('_id');
    if (exists) {
        return { skipped: 'A member with this email already exists' };
    }

    const temporaryPassword = makeTemporaryPassword();
    const user = await User.create({
        ...member,
        password: temporaryPassword,
        isAdmin: false,
        isLeader: false,
        profileVisibility: DEFAULT_PROFILE_VISIBILITY,
    });

    return {
        created: {
            user: toPrivateUserDto(user),
            // This is intentionally returned once to the authenticated admin;
            // it is never stored or returned by any read endpoint.
            temporaryPassword,
        },
    };
};

/** Admin-only manual member provisioning. Roles and passwords are never accepted from input. */
export const createMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await provisionMember(req.body || {});
        if ('error' in result) {
            return res.status(400).json({ status: 'error', message: result.error });
        }
        if ('skipped' in result) {
            return res.status(409).json({ status: 'error', message: result.skipped });
        }

        return res.status(201).json({ status: 'success', data: result.created });
    } catch (error) {
        return next(error);
    }
};

/** Admin-only CSV import. The caller parses the CSV and submits a row array. */
export const createManyUsersByCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rows = req.body?.users;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ status: 'error', message: 'users must be an array' });
        }

        const report: Array<Record<string, unknown>> = [];
        for (let index = 0; index < rows.length; index += 1) {
            const result = await provisionMember(rows[index] || {});
            const email = text(rows[index]?.email).toLowerCase() || null;
            if ('created' in result) {
                report.push({ row: index + 1, email, created: result.created });
            } else if ('skipped' in result) {
                report.push({ row: index + 1, email, skipped: true, reason: result.skipped });
            } else {
                report.push({ row: index + 1, email, errors: [result.error] });
            }
        }

        const created = report.filter((row) => 'created' in row).length;
        const skipped = report.filter((row) => row.skipped === true).length;
        const errors = report.length - created - skipped;
        return res.status(201).json({
            status: errors ? 'partial_success' : 'success',
            data: { created, skipped, errors, rows: report },
        });
    } catch (error) {
        return next(error);
    }
};

const isAdmin = (res: Response) => Boolean(res.locals.auth?.isAdmin);
const isPresident = (res: Response) =>
    Boolean(res.locals.auth?.isAdmin && res.locals.auth?.positionConstant === PRESIDENT_POSITION);
const isExecutivePosition = (position: any) =>
    [PRESIDENT_POSITION, VICE_PRESIDENT_POSITION].includes(position?.constant);
const isPresidentPosition = (position: any) => position?.constant === PRESIDENT_POSITION;
const canSeePrivateUser = (res: Response, user: any) =>
    isAdmin(res) || res.locals.auth?.userId === user?._id?.toString();

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 24, 1), 100);
        const skip = (page - 1) * limit;
        const filter: Record<string, unknown> = {};
        const admin = isAdmin(res);

        if (req.query.filter) {
            try {
                const requested = JSON.parse(req.query.filter as string) as Record<string, unknown>;
                for (const [key, value] of Object.entries(requested)) {
                    if (value !== '') {
                        filter[key] = value;
                    }
                }
                if (filter.departments && typeof filter.departments === 'string') {
                    filter.departments = {
                        $in: filter.departments
                            .split(',')
                            .map((id) => new mongoose.Types.ObjectId(id.trim())),
                    };
                }
                if (!admin) {
                    delete filter.MSSV;
                    delete filter.email;
                    delete filter.phone;
                    delete filter.kGeneration;
                }
            } catch (_error) {
                return res.status(400).json({ status: 'fail', message: 'Invalid filter format' });
            }
        }

        const search = typeof req.query.search === 'string' ? req.query.search.replace(/^"|"$/g, '') : '';
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = admin
                ? [{ firstname: searchRegex }, { lastname: searchRegex }, { email: searchRegex }, { nickname: searchRegex }]
                : [{ firstname: searchRegex }, { lastname: searchRegex }, { nickname: searchRegex }];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ isAdmin: -1, isExcellent: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('majorId')
                .populate('positionId')
                .populate('departments')
                .populate('socials.socialId'),
            User.countDocuments(filter),
        ]);

        return res.status(200).json({
            status: 'success',
            results: users.length,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data: { users: users.map((user: any) => (admin ? toPrivateUserDto(user) : toPublicUserDto(user))) },
        });
    } catch (error) {
        return next(error);
    }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const identifier = req.params.userId;
        const canUseInternalIdentifier = isAdmin(res) || res.locals.auth?.userId === identifier;
        let user = await User.findOne({ nickname: identifier })
            .populate('majorId')
            .populate('positionId')
            .populate('departments')
            .populate('socials.socialId');

        // A private nickname is not a public profile locator. New public cards
        // use profileKey instead, so users do not need to opt in to nicknames.
        if (user && !canSeePrivateUser(res, user) && user.profileVisibility?.nickname !== true) {
            user = null;
        }

        if (!user && identifier.startsWith('p_')) {
            // Existing documents do not require a migration. The collection is
            // small today; replace this with an indexed random publicProfileId
            // if the club grows beyond this transitional approach.
            const candidates = await User.find({}).select('_id');
            const match = candidates.find((candidate: any) => toPublicProfileKey(candidate) === identifier);
            if (match) {
                user = await User.findById(match._id)
                    .populate('majorId')
                    .populate('positionId')
                    .populate('departments')
                    .populate('socials.socialId');
            }
        }

        if (!user && canUseInternalIdentifier && mongoose.Types.ObjectId.isValid(identifier)) {
            user = await User.findById(identifier)
                .populate('majorId')
                .populate('positionId')
                .populate('departments')
                .populate('socials.socialId');
        }
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }

        const leaderboard = await Leaderboard.findOne({ userId: user._id }).select('leetcodeUsername acSubmissionList');
        const privateAccess = canSeePrivateUser(res, user);
        const userData = privateAccess ? toPrivateUserDto(user) : toPublicUserDto(user);
        const canExposeLeetcode = privateAccess || user.profileVisibility?.leetcode === true;
        const submissions = canExposeLeetcode
            ? leaderboard?.acSubmissionList
            : leaderboard?.acSubmissionList?.map((submission: any) => {
                  const { _id, ...safeSubmission } = submission.toObject ? submission.toObject() : submission;
                  return safeSubmission;
              });
        const leaderboardData = canExposeLeetcode
            ? { leetcodeUsername: leaderboard?.leetcodeUsername, acSubmissionList: submissions }
            : {};
        return res.status(200).json({
            status: 'success',
            data: { ...userData, ...leaderboardData },
        });
    } catch (error) {
        return next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.userId;
        if (!isAdmin(res) && res.locals.auth?.userId !== userId) {
            return res.status(403).json({ status: 'error', message: 'You are not allowed to change this password' });
        }
        const { oldPassword, newPassword } = req.body || {};
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        if (!isAdmin(res) && (typeof oldPassword !== 'string' || !bcrypt.compareSync(oldPassword, user.password))) {
            return res.status(400).json({ status: 'error', message: 'Old password is incorrect' });
        }

        user.password = newPassword;
        await user.save();
        return res.status(200).json({ status: 'success', message: 'Password changed successfully' });
    } catch (error) {
        return next(error);
    }
};

export const editProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.userId;
        if (!isAdmin(res)) {
            return res.status(403).json({ status: 'error', message: 'Administrator access is required' });
        }
        const updateData = { ...(req.body || {}) };
        ['_id', 'email', 'password', 'isAdmin', 'isLeader', 'positionId', 'profileVisibility'].forEach((field) => delete updateData[field]);
        const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        return res.status(200).json({ status: 'success', message: 'Profile updated successfully', data: toPrivateUserDto(user) });
    } catch (error) {
        return next(error);
    }
};

/**
 * Admin-only role mutation. Roles are intentionally kept separate from profile
 * updates so importing or editing member details can never silently grant
 * elevated access.
 */
export const setUserAdminRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requestedAdmin = req.body?.isAdmin;
        const updatesAdmin = typeof requestedAdmin === 'boolean';
        if (!updatesAdmin) {
            return res.status(400).json({
                status: 'error',
                message: 'isAdmin must be a boolean',
            });
        }

        if (!isPresident(res)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only a President can change administrator access',
            });
        }

        const user = await User.findById(req.params.userId).populate('positionId');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }

        if (user.isAdmin === requestedAdmin) {
            return res.status(200).json({
                status: 'success',
                message: 'Administrator access is already up to date',
                data: toPrivateUserDto(user),
            });
        }

        if (!requestedAdmin && isPresidentPosition(user.positionId)) {
            return res.status(409).json({
                status: 'error',
                message: 'A President must retain administrator access',
            });
        }

        user.isAdmin = requestedAdmin;
        await user.save();
        return res.status(200).json({
            status: 'success',
            message: requestedAdmin ? 'Administrator access granted' : 'Administrator access revoked',
            data: toPrivateUserDto(user),
        });
    } catch (error) {
        return next(error);
    }
};

export const setUserPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const positionId = req.body?.positionId;
        if (typeof positionId !== 'string' || !mongoose.Types.ObjectId.isValid(positionId)) {
            return res.status(400).json({ status: 'error', message: 'A valid positionId is required' });
        }
        const [user, nextPosition] = await Promise.all([
            User.findById(req.params.userId).populate('positionId'),
            Position.findById(positionId),
        ]);
        if (!user) return res.status(404).json({ status: 'error', message: 'Member not found' });
        if (!nextPosition) return res.status(404).json({ status: 'error', message: 'Position not found' });

        const currentPosition = user.positionId as any;
        if ((isExecutivePosition(currentPosition) || isExecutivePosition(nextPosition)) && !isPresident(res)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only a President can assign Executive Committee titles',
            });
        }
        if (isPresidentPosition(currentPosition) && !isPresidentPosition(nextPosition)) {
            const presidentCount = await User.countDocuments({ positionId: currentPosition._id });
            if (presidentCount <= 1) {
                return res.status(409).json({ status: 'error', message: 'The final President title cannot be removed' });
            }
        }

        user.positionId = nextPosition._id;
        if (isPresidentPosition(nextPosition)) user.isAdmin = true;
        await user.save();
        await user.populate('positionId');
        return res.status(200).json({ status: 'success', message: 'Position updated successfully', data: toPrivateUserDto(user) });
    } catch (error) {
        return next(error);
    }
};

export const setUserTeamLeadership = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isLeader = req.body?.isLeader;
        if (typeof isLeader !== 'boolean') {
            return res.status(400).json({ status: 'error', message: 'isLeader must be a boolean' });
        }
        const user = await User.findByIdAndUpdate(req.params.userId, { isLeader }, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ status: 'error', message: 'Member not found' });
        return res.status(200).json({
            status: 'success',
            message: isLeader ? 'Team leadership assigned' : 'Team leadership removed',
            data: toPrivateUserDto(user),
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(res)) {
            return res.status(403).json({ status: 'error', message: 'Administrator access is required' });
        }
        const user = await User.findById(req.params.userId).populate('positionId').select('isAdmin positionId');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        if (isExecutivePosition(user.positionId) && !isPresident(res)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only a President can delete Executive Committee accounts',
            });
        }
        if (isPresidentPosition(user.positionId)) {
            if (!isPresident(res)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only a President can delete a President account',
                });
            }
            const presidentCount = await User.countDocuments({ positionId: (user.positionId as any)._id });
            if (presidentCount <= 1) {
                return res.status(409).json({
                    status: 'error',
                    message: 'The final President cannot be deleted',
                });
            }
        }
        if (user.isAdmin && !isPresident(res)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only a President can delete an administrator account',
            });
        }
        await User.findByIdAndDelete(req.params.userId);
        return res.status(200).json({ status: 'success', message: 'Member deleted successfully' });
    } catch (error) {
        return next(error);
    }
};

export const resetPasword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(res)) {
            return res.status(403).json({ status: 'error', message: 'Administrator access is required' });
        }
        const temporaryPassword = makeTemporaryPassword();
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        user.password = temporaryPassword;
        await user.save();
        return res.status(200).json({
            status: 'success',
            data: { temporaryPassword },
            message: 'Temporary password generated. Share it through a secure channel.',
        });
    } catch (error) {
        return next(error);
    }
};
