import mongoose from 'mongoose';
import { Notification, INotification } from '../models/NotificationModel';
import { socketServer } from '../socket';
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
        | 'system_alert';
    title: string;
    message: string;
    link?: string;
    meta?: Record<string, any>;
    sendTelegram?: boolean;
}

export const createNotification = async (params: CreateNotificationParams): Promise<INotification> => {
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
    try {
        if (recipientRole === 'admin') {
            socketServer.emitToAdmin('notification:new', notification);
        } else if (recipientRole === 'all') {
            socketServer.emitToAll('notification:new', notification);
        } else if (recipientId) {
            socketServer.emitToUser(recipientId.toString(), 'notification:new', notification);
        }
    } catch (err) {
        console.warn('[Notification Socket Error]:', err);
    }

    // 2. Automated Telegram Bot Notification
    if (sendTelegram) {
        try {
            if (type === 'blog_submitted') {
                await notifyAdminNewBlogSubmission(meta.blog, meta.author);
            } else if (['blog_approved', 'blog_rejected', 'blog_changes_requested'].includes(type)) {
                await notifyBlogReviewResult(meta.blog, meta.status, meta.reviewNotes);
            } else if (['badge_unlocked', 'level_up', 'streak_milestone'].includes(type)) {
                await notifyGamificationMilestone(meta.user, meta.milestone);
            } else if (type === 'system_alert') {
                await notifySystemAlert(title, message);
            }
        } catch (err) {
            console.warn('[Notification Telegram Error]:', err);
        }
    }

    return notification;
};
