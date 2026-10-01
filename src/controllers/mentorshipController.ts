import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Alumni } from '../models/AlumniModel';
import { MENTORSHIP_TOPICS, MentorshipRequest } from '../models/MentorshipRequestModel';
import { recordAdminAudit } from '../models/AdminAuditLogModel';
import { createNotification } from '../services/notificationService';

/** Public mentor directory: published mentors only, safe fields (no contact). */
export const getMentors = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const mentors = await Alumni.find({ isMentor: true, isPublished: true })
            .select('name headline bio quote workplace avatar graduationGen mentoringTopics')
            .sort({ createdAt: -1 })
            .lean();
        return res.status(200).json({ status: 'success', results: mentors.length, data: mentors });
    } catch (error) {
        return next(error);
    }
};

/** Authenticated member asks a mentor for guidance (no contact exchange yet). */
export const requestMentorship = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requesterId = res.locals.auth?.userId;
        if (!requesterId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }
        const { alumniId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(alumniId)) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid mentor' });
        }
        const topic = typeof req.body?.topic === 'string' ? req.body.topic : '';
        const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
        if (!(MENTORSHIP_TOPICS as readonly string[]).includes(topic)) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid mentoring topic' });
        }
        const mentor = await Alumni.findById(alumniId).select('name isMentor isPublished userId');
        if (!mentor || !mentor.isMentor || !mentor.isPublished) {
            return res.status(404).json({ status: 'error', message: 'Mentor không tồn tại hoặc chưa mở kết nối' });
        }
        const duplicate = await MentorshipRequest.findOne({ alumniId, requesterId, status: 'pending' }).select('_id');
        if (duplicate) {
            return res.status(409).json({ status: 'error', message: 'Bạn đã có yêu cầu đang chờ với mentor này' });
        }
        const request = await MentorshipRequest.create({ alumniId, requesterId, topic, message, status: 'pending' });
        // Notify the mentor only when the alumni record links to a member account.
        if (mentor.userId) {
            createNotification({
                recipientId: mentor.userId.toString(),
                type: 'mentorship_requested',
                title: 'Yêu cầu kết nối mentee mới',
                message: `Một thành viên muốn được bạn cố vấn chủ đề "${topic}".`,
                link: '/vi/dashboard',
                meta: { alumniId: String(mentor._id), topic },
            }).catch(() => {});
        }
        return res.status(201).json({
            status: 'success',
            data: {
                _id: request._id,
                alumniId: request.alumniId,
                topic: request.topic,
                message: request.message,
                status: request.status,
                createdAt: (request as any).createdAt,
            },
        });
    } catch (error) {
        return next(error);
    }
};

/** My mentorship requests with mentor card + decision state. */
export const getMyMentorshipRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requesterId = res.locals.auth?.userId;
        if (!requesterId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }
        const rows = await MentorshipRequest.find({ requesterId })
            .sort({ createdAt: -1 })
            .populate('alumniId', 'name headline avatar workplace graduationGen mentoringTopics')
            .lean();
        return res.status(200).json({ status: 'success', results: rows.length, data: rows });
    } catch (error) {
        return next(error);
    }
};

/** Admin-only request queue with mentor + requester cards. */
export const listMentorshipRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 24, 1), 100);
        const skip = (page - 1) * limit;
        const filter: Record<string, unknown> = {};
        if (typeof req.query.status === 'string' && req.query.status) {
            if (!['pending', 'accepted', 'declined'].includes(req.query.status)) {
                return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid status filter' });
            }
            filter.status = req.query.status;
        }
        if (typeof req.query.alumniId === 'string' && req.query.alumniId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.alumniId)) {
                return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid alumniId filter' });
            }
            filter.alumniId = req.query.alumniId;
        }
        const [rows, total] = await Promise.all([
            MentorshipRequest.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('alumniId', 'name headline avatar workplace')
                .populate('requesterId', 'firstname lastname email gen')
                .lean(),
            MentorshipRequest.countDocuments(filter),
        ]);
        return res.status(200).json({
            status: 'success',
            results: rows.length,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data: rows,
        });
    } catch (error) {
        return next(error);
    }
};

/** Admin review: accept opens contact exchange, decline closes the request. */
export const reviewMentorshipRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status } = req.body || {};
        if (status !== 'accepted' && status !== 'declined') {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid review status' });
        }
        const request = await MentorshipRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        if (request.status !== 'pending') {
            return res.status(409).json({ status: 'error', message: 'Request already reviewed' });
        }
        request.status = status;
        request.reviewedBy = res.locals.auth?.userId || null;
        request.reviewedAt = new Date();
        await request.save();
        recordAdminAudit({
            actorId: res.locals.auth?.userId || null,
            action: 'mentorship.reviewed',
            targetType: 'mentorship',
            targetId: String(request._id),
            summary: `Mentorship ${status}: ${request.topic}`.slice(0, 500),
            before: { status: 'pending' },
            after: { status },
            ip: req.ip || '',
        });
        createNotification({
            recipientId: request.requesterId.toString(),
            type: 'mentorship_reviewed',
            title: status === 'accepted' ? 'Mentor đã nhận lời kết nối!' : 'Yêu cầu kết nối chưa được duyệt',
            message:
                status === 'accepted'
                    ? 'Mentor đồng ý đồng hành cùng bạn. Hãy chủ động liên hệ qua kênh CLB nhé!'
                    : 'Yêu cầu của bạn chưa được duyệt lần này. Hãy thử mentor khác phù hợp hơn nhé!',
            link: '/vi/dashboard',
            meta: { requestId: String(request._id), status },
        }).catch(() => {});
        return res.status(200).json({ status: 'success', data: request });
    } catch (error) {
        return next(error);
    }
};
