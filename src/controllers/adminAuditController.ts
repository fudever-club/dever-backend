import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AdminAuditLog } from '../models/AdminAuditLogModel';

const ADMIN_AUDIT_ACTIONS = [
    'user.role_granted',
    'user.role_revoked',
    'user.position_changed',
    'user.leadership_changed',
    'user.deleted',
    'user.password_reset',
    'user.sessions_revoked',
    'fund.payment_approved',
    'fund.payment_rejected',
    'blog.reviewed',
    'opensource.approved',
    'opensource.rejected',
    'opensource.deleted',
    'user.invited',
    'user.accepted',
    'user.invite_revoked',
];

const ADMIN_AUDIT_TARGET_TYPES = [
    'user',
    'fund_payment',
    'blog',
    'open_source',
    'event',
    'project',
    'campaign',
    'position',
];

/**
 * Admin-only append-only audit trail (general mutations).
 * Mirrors fund getAdminAuditLog response shape.
 */
export const getAdminAuditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const filter: Record<string, unknown> = {};

        if (req.query.action !== undefined && req.query.action !== '') {
            if (typeof req.query.action !== 'string' || !ADMIN_AUDIT_ACTIONS.includes(req.query.action)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid action filter',
                });
            }
            filter.action = req.query.action;
        }

        if (req.query.targetType !== undefined && req.query.targetType !== '') {
            if (typeof req.query.targetType !== 'string' || !ADMIN_AUDIT_TARGET_TYPES.includes(req.query.targetType)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid targetType filter',
                });
            }
            filter.targetType = req.query.targetType;
        }

        if (req.query.actorId !== undefined && req.query.actorId !== '') {
            if (typeof req.query.actorId !== 'string' || !mongoose.Types.ObjectId.isValid(req.query.actorId)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid actorId filter',
                });
            }
            filter.actorId = req.query.actorId;
        }

        if (req.query.targetId !== undefined && req.query.targetId !== '') {
            if (typeof req.query.targetId !== 'string') {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid targetId filter',
                });
            }
            const targetId = req.query.targetId.trim();
            if (!targetId || targetId.length > 200) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid targetId filter',
                });
            }
            filter.targetId = targetId;
        }

        const [entries, total] = await Promise.all([
            AdminAuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('actorId', 'firstname lastname email')
                .lean(),
            AdminAuditLog.countDocuments(filter),
        ]);

        return res.status(200).json({
            status: 'success',
            results: entries.length,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data: entries,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * Admin-only action funnel: counts per action per day for the last N days.
 * Powers BCN dashboards (submission -> review funnels, queue velocity)
 * without paging through the raw log.
 */
export const getAdminAuditSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await AdminAuditLog.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        action: '$action',
                        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.day': 1, '_id.action': 1 } },
        ]);
        const byAction: Record<string, number> = {};
        const series = rows.map((row: any) => {
            byAction[row._id.action] = (byAction[row._id.action] || 0) + row.count;
            return { date: row._id.day, action: row._id.action, count: row.count };
        });
        return res.status(200).json({ status: 'success', data: { days, byAction, series } });
    } catch (error) {
        return next(error);
    }
};
