import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { User } from '../models/UserModel';
import { InviteToken, hashInviteToken } from '../models/InviteTokenModel';
import { DEFAULT_PROFILE_VISIBILITY, toPrivateUserDto } from '../Utils/userDto';
import { recordAdminAudit } from '../models/AdminAuditLogModel';
import { issueSession, setAuthCookies } from '../Utils/session';

const emailValidator = require('email-validator');

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const BULK_MAX_ROWS = 200;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Show first char + domain only: dangquangnhat1504@gmail.com -> d***@gmail.com */
const maskEmail = (email: string): string => {
    const at = email.indexOf('@');
    if (at <= 0) return '***';
    return `${email[0]}***${email.slice(at)}`;
};

const isExpired = (invite: { expiresAt: Date }) => invite.expiresAt.getTime() <= Date.now();

const toInviteDto = (invite: any) => ({
    _id: invite._id,
    email: invite.email,
    firstname: invite.firstname,
    lastname: invite.lastname,
    status: invite.status,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    isExpired: invite.status === 'pending' && isExpired(invite),
});

const invalidInvite = (res: Response) =>
    res.status(410).json({
        status: 'error',
        code: 'INVITE_INVALID',
        message: 'Thư mời không hợp lệ hoặc đã hết hạn',
    });

/** Shared single-row logic for manual + bulk creation (resend semantics:
 *  any older pending invite for the same email is revoked first). */
const createInviteCore = async (
    input: { email?: unknown; firstname?: unknown; lastname?: unknown },
    invitedBy: string | null,
): Promise<
    | { created: { invite: ReturnType<typeof toInviteDto>; token: string } }
    | { skipped: string }
    | { error: string }
> => {
    const email = text(input.email).toLowerCase();
    const firstname = text(input.firstname);
    const lastname = text(input.lastname);
    if (!email || !emailValidator.validate(email)) {
        return { error: 'A valid email is required' };
    }
    const exists = await User.findOne({ email }).select('_id');
    if (exists) {
        return { skipped: 'A member with this email already exists' };
    }
    await InviteToken.updateMany(
        { email, status: 'pending' },
        { $set: { status: 'revoked' } },
    );
    const token = randomBytes(32).toString('hex');
    const invite = await InviteToken.create({
        email,
        firstname,
        lastname,
        tokenHash: hashInviteToken(token),
        invitedBy: invitedBy || null,
        status: 'pending',
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    recordAdminAudit({
        actorId: invitedBy,
        action: 'user.invited',
        targetType: 'user',
        targetId: email,
        summary: `Invited ${email}`.slice(0, 500),
        ip: '',
    });
    return { created: { invite: toInviteDto(invite), token } };
};

/** Admin-only single invite. The plaintext token is returned ONCE for the
 *  admin to copy — it is never stored or returned again. */
export const createInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await createInviteCore(req.body || {}, res.locals.auth?.userId || null);
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

/** Admin-only bulk invites. The caller submits a row array (or pasted list
 *  parsed client-side); per-row report mirrors the CSV provisioning shape. */
export const createBulkInvites = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rows = req.body?.users;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'users must be a non-empty array' });
        }
        if (rows.length > BULK_MAX_ROWS) {
            return res.status(400).json({ status: 'error', message: `Too many rows (max ${BULK_MAX_ROWS})` });
        }
        const report: Array<Record<string, unknown>> = [];
        for (let index = 0; index < rows.length; index += 1) {
            const result = await createInviteCore(rows[index] || {}, res.locals.auth?.userId || null);
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

/** Admin-only invite tracking table (who accepted / pending / expired). */
export const listInvites = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 24, 1), 100);
        const skip = (page - 1) * limit;
        const filter: Record<string, unknown> = {};
        if (typeof req.query.status === 'string' && req.query.status) {
            if (!['pending', 'accepted', 'revoked'].includes(req.query.status)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid status filter',
                });
            }
            filter.status = req.query.status;
        }
        const [rows, total] = await Promise.all([
            InviteToken.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('invitedBy', 'firstname lastname email')
                .lean(),
            InviteToken.countDocuments(filter),
        ]);
        return res.status(200).json({
            status: 'success',
            results: rows.length,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data: rows.map((row: any) => ({
                ...toInviteDto(row),
                invitedBy: row.invitedBy || null,
            })),
        });
    } catch (error) {
        return next(error);
    }
};

/** Admin-only revoke (wrong email rows). Only pending invites can be revoked. */
export const revokeInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invite = await InviteToken.findById(req.params.inviteId);
        if (!invite) {
            return res.status(404).json({ status: 'error', message: 'Invite not found' });
        }
        if (invite.status !== 'pending') {
            return res.status(409).json({ status: 'error', message: 'Only pending invites can be revoked' });
        }
        invite.status = 'revoked';
        await invite.save();
        recordAdminAudit({
            actorId: res.locals.auth?.userId || null,
            action: 'user.invite_revoked',
            targetType: 'user',
            targetId: invite.email,
            summary: `Revoked invite for ${invite.email}`.slice(0, 500),
            ip: req.ip || '',
        });
        return res.status(200).json({ status: 'success', data: toInviteDto(invite) });
    } catch (error) {
        return next(error);
    }
};

/** Admin-only resend (expired rows): revoke the old token, mint a fresh one. */
export const resendInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invite = await InviteToken.findById(req.params.inviteId);
        if (!invite) {
            return res.status(404).json({ status: 'error', message: 'Invite not found' });
        }
        if (invite.status === 'accepted') {
            return res.status(409).json({ status: 'error', message: 'Invite already accepted' });
        }
        const result = await createInviteCore(
            { email: invite.email, firstname: invite.firstname, lastname: invite.lastname },
            res.locals.auth?.userId || null,
        );
        if (!('created' in result)) {
            return res.status(409).json({
                status: 'error',
                message: 'error' in result ? result.error : result.skipped,
            });
        }
        return res.status(201).json({ status: 'success', data: result.created });
    } catch (error) {
        return next(error);
    }
};

/** Public invite validation: masked email only, never member data. */
export const validateInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = typeof req.params.token === 'string' ? req.params.token : '';
        if (!token) {
            return invalidInvite(res);
        }
        const invite = await InviteToken.findOne({ tokenHash: hashInviteToken(token) }).select(
            'email firstname expiresAt status',
        );
        if (!invite || invite.status !== 'pending' || isExpired(invite)) {
            return invalidInvite(res);
        }
        return res.status(200).json({
            status: 'success',
            data: {
                emailMasked: maskEmail(invite.email),
                firstname: invite.firstname || '',
                expiresAt: invite.expiresAt,
            },
        });
    } catch (error) {
        return next(error);
    }
};

/** Public invite acceptance: recipient sets their own password, account is
 *  created as a plain member, and the session starts immediately. */
export const acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = typeof req.params.token === 'string' ? req.params.token : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (!token) {
            return invalidInvite(res);
        }
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: 'Password must be at least 6 characters',
            });
        }
        const invite = await InviteToken.findOne({ tokenHash: hashInviteToken(token) });
        if (!invite || invite.status !== 'pending' || isExpired(invite)) {
            return invalidInvite(res);
        }
        const exists = await User.findOne({ email: invite.email }).select('_id');
        if (exists) {
            invite.status = 'revoked';
            await invite.save();
            return res.status(409).json({ status: 'error', message: 'A member with this email already exists' });
        }
        const user = await User.create({
            email: invite.email,
            firstname: invite.firstname || null,
            lastname: invite.lastname || null,
            password,
            isAdmin: false,
            isLeader: false,
            tokenVersion: 0,
            profileVisibility: DEFAULT_PROFILE_VISIBILITY,
        });
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        await invite.save();
        recordAdminAudit({
            actorId: null,
            action: 'user.accepted',
            targetType: 'user',
            targetId: invite.email,
            summary: `${invite.email} accepted invite`.slice(0, 500),
            ip: req.ip || '',
        });
        const session = await issueSession(user._id.toString(), 0);
        const accessToken = session.accessToken;
        setAuthCookies(req, res, { access: accessToken, refresh: session.refreshToken });
        return res.status(201).json({
            status: 'success',
            data: { user: toPrivateUserDto(user), token: accessToken },
        });
    } catch (error) {
        return next(error);
    }
};
