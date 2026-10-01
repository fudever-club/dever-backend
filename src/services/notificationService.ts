import mongoose from 'mongoose';
import { Notification, INotification } from '../models/NotificationModel';
import { User } from '../models/UserModel';
import { socketServer } from '../socket';
import { toNotificationDto } from '../Utils/notificationDto';
import {
    notifyAdminNewBlogSubmission,
    notifyBlogReviewResult,
    notifyGamificationMilestone,
    notifySystemAlert,
} from './telegramService';

export interface CreateNotificationParams {
    recipientId?: string | mongoose.Types.ObjectId | null;
    recipientRole?: 'all' | 'admin' | 'member';
    type:
        | 'blog_submitted'
        | 'blog_approved'
        | 'blog_rejected'
        | 'blog_changes_requested'
        | 'badge_unlocked'
        | 'level_up'
        | 'streak_milestone'
        | 'event_created'
        | 'mentorship_requested'
        | 'mentorship_reviewed'
        | 'system_alert';
    title: string;
    message: string;
    link?: string;
    meta?: Record<string, any>;
    sendTelegram?: boolean;
}

/** Lifestyle categories a member may mute. Everything else is transactional
 *  or operational and always delivers. */
export const NOTIFICATION_MUTE_CATEGORIES: Record<string, 'arena' | 'event'> = {
    badge_unlocked: 'arena',
    level_up: 'arena',
    streak_milestone: 'arena',
    event_created: 'event',
};

export const NOTIFICATION_PREF_KEYS = ['arena', 'event'] as const;

export const createNotification = async (params: CreateNotificationParams): Promise<INotification | null> => {
    const {
        recipientId = null,
        recipientRole = 'member',
        type,
        title,
        message,
        link = '',
        meta = {},
        sendTelegram = false,
    } = params;

    // Mutable lifestyle categories honor the recipient's opt-out. Transactional
    // notices (review results, fund receipts, system alerts, admin ops) and
    // role broadcasts always deliver. Legacy members without prefs read as on.
    const gatedCategory = NOTIFICATION_MUTE_CATEGORIES[type];
    if (recipientId && gatedCategory) {
        const prefUser = await User.findById(recipientId).select('notificationPrefs');
        const prefs = prefUser?.notificationPrefs as { arena?: boolean; event?: boolean } | undefined;
        if (prefs && prefs[gatedCategory] === false) {
            return null;
        }
    }

    const notification = await Notification.create({
        recipientId: recipientId ? new mongoose.Types.ObjectId(recipientId) : null,
        recipientRole,
        type,
        title,
        message,
        link,
        isRead: false,
        meta,
    });

    // 1. Realtime Push via Socket.io
    // Never emit the raw Mongoose document: historical records embed full
    // user/project objects (credential-bearing PII) in `meta`. The public
    // DTO strips recipient linkage, meta, and server-internal fields.
    try {
        const socketPayload = toNotificationDto(notification, false);
        if (recipientRole === 'admin') {
            socketServer.emitToAdmin('notification:new', socketPayload);
        } else if (recipientRole === 'all') {
            socketServer.emitToAll('notification:new', socketPayload);
        } else if (recipientId) {
            socketServer.emitToUser(recipientId.toString(), 'notification:new', socketPayload);
        }
    } catch (err) {
        console.warn('[Notification Socket Error]:', err);
    }

    // 2. Automated Telegram Bot Notification
    // `meta` is identifier-only ({ blogId/blogTitle, projectId/projectTitle,
    // authorName/userName, status, reviewNotes, milestone }). Resolve the
    // legacy full-object shape and the minimal shape so Telegram keeps
    // working for both new and historical records.
    if (sendTelegram) {
        try {
            const blogRef =
                (meta as any).blog ??
                ((meta as any).blogId || (meta as any).blogTitle
                    ? {
                          _id: (meta as any).blogId,
                          title: (meta as any).blogTitle,
                          slug: (meta as any).blogSlug,
                      }
                    : undefined);
            const authorRef =
                (meta as any).author ?? ((meta as any).authorName ? { name: (meta as any).authorName } : undefined);
            const userRef =
                (meta as any).user ??
                ((meta as any).userName
                    ? { name: (meta as any).userName }
                    : (meta as any).userId
                      ? { _id: (meta as any).userId }
                      : undefined);
            if (type === 'blog_submitted') {
                await notifyAdminNewBlogSubmission(blogRef, authorRef);
            } else if (['blog_approved', 'blog_rejected', 'blog_changes_requested'].includes(type)) {
                await notifyBlogReviewResult(blogRef, (meta as any).status, (meta as any).reviewNotes);
            } else if (['badge_unlocked', 'level_up', 'streak_milestone'].includes(type)) {
                await notifyGamificationMilestone(userRef, (meta as any).milestone);
            } else if (type === 'system_alert') {
                await notifySystemAlert(title, message);
            }
        } catch (err) {
            console.warn('[Notification Telegram Error]:', err);
        }
    }

    return notification;
};
