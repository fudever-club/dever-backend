import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/NotificationModel';
import { NotificationRead } from '../models/NotificationReadModel';
import { User } from '../models/UserModel';
import { NOTIFICATION_PREF_KEYS } from '../services/notificationService';
import { toNotificationDto } from '../Utils/notificationDto';
import { testTelegramBotConnection } from '../services/telegramService';

/**
 * Visibility rule: a personal notification belongs to exactly one member; a
 * broadcast belongs to everyone only when it addresses nobody in particular.
 * Records addressed to a *different* member stay hidden even when they carry
 * a broadcast role.
 */
const visibleNotificationsQuery = (userId: string, isAdmin: boolean) => ({
    $or: [
        { recipientId: new mongoose.Types.ObjectId(userId) },
        { recipientRole: 'all', recipientId: null },
        ...(isAdmin ? [{ recipientRole: 'admin' }] : []),
    ],
});

const readNotificationIds = async (userId: string): Promise<Set<string>> => {
    const ids = await NotificationRead.distinct('notificationId', {
        userId: new mongoose.Types.ObjectId(userId),
    });
    return new Set((ids || []).map(String));
};

/**
 * Get current user's notifications (includes personal + relevant role/broadcast notifications)
 */
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
        const skip = (page - 1) * limit;

        const query = visibleNotificationsQuery(userId, isAdmin);

        const [notifications, total, readIds] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments(query),
            readNotificationIds(userId),
        ]);

        const data = notifications.map((notification: any) =>
            toNotificationDto(notification, readIds.has(String(notification._id))),
        );

        return res.status(200).json({
            status: 'success',
            results: data.length,
            total,
            unreadCount: Math.max(0, total - readIds.size),
            page,
            totalPages: Math.ceil(total / limit),
            data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a single notification as read (per-reader receipt; the shared document
 * is never mutated, so other readers are unaffected)
 */
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid notification ID' });
        }

        const isAdmin = Boolean(res.locals.auth?.isAdmin);
        const notification = await Notification.findOne({
            _id: id,
            $or: (visibleNotificationsQuery(userId, isAdmin) as any).$or,
        });

        if (!notification) {
            return res.status(404).json({ status: 'error', message: 'Notification not found' });
        }

        await NotificationRead.updateOne(
            { userId: new mongoose.Types.ObjectId(userId), notificationId: notification._id },
            { $setOnInsert: { userId: new mongoose.Types.ObjectId(userId), notificationId: notification._id, readAt: new Date() } },
            { upsert: true },
        );

        return res.status(200).json({
            status: 'success',
            data: toNotificationDto(notification, true),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all notifications for the user as read (receipts for visible docs only;
 * shared documents are never mutated)
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        const query = visibleNotificationsQuery(userId, isAdmin);
        const visible = await Notification.find(query).select('_id');
        if (visible.length > 0) {
            await NotificationRead.bulkWrite(
                visible.map((doc: any) => ({
                    updateOne: {
                        filter: {
                            userId: new mongoose.Types.ObjectId(userId),
                            notificationId: doc._id,
                        },
                        update: {
                            $setOnInsert: {
                                userId: new mongoose.Types.ObjectId(userId),
                                notificationId: doc._id,
                                readAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                })),
            );
        }

        return res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid notification ID' });
        }

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({ status: 'error', message: 'Notification not found' });
        }

        // Only owner or admin can delete
        const isOwner = notification.recipientId && notification.recipientId.toString() === userId.toString();
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'Permission denied' });
        }

        await Notification.findByIdAndDelete(id);
        // Drop orphaned read receipts so they cannot skew future unread counts.
        await NotificationRead.deleteMany({ notificationId: id }).catch(() => {});

        return res.status(200).json({
            status: 'success',
            message: 'Notification deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get my notification preferences (mutable categories only; legacy members
 * without stored prefs read as all-true).
 */
export const getMyNotificationPrefs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }
        const user = await User.findById(userId).select('notificationPrefs');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        const prefs = (user as any).notificationPrefs || {};
        return res.status(200).json({
            status: 'success',
            data: {
                arena: prefs.arena !== false,
                event: prefs.event !== false,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update my notification preferences. Strict whitelist: only known keys,
 * only booleans — never mass-assign req.body.
 */
export const updateMyNotificationPrefs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }
        const body = req.body || {};
        const update: Record<string, boolean> = {};
        for (const key of NOTIFICATION_PREF_KEYS) {
            if (body[key] === undefined) continue;
            if (typeof body[key] !== 'boolean') {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: `Preference '${key}' must be a boolean`,
                });
            }
            update[`notificationPrefs.${key}`] = body[key];
        }
        if (Object.keys(update).length === 0) {
            return res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: 'No valid preferences provided',
            });
        }
        await User.findByIdAndUpdate(userId, { $set: update }, { runValidators: true });
        const user = await User.findById(userId).select('notificationPrefs');
        const prefs = (user as any)?.notificationPrefs || {};
        return res.status(200).json({
            status: 'success',
            data: { arena: prefs.arena !== false, event: prefs.event !== false },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Test Telegram bot integration (Admin only)
 */
export const testTelegramBot = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customChatId = req.body.chatId;
        const result = await testTelegramBotConnection(customChatId);

        if (result.success) {
            return res.status(200).json({
                status: 'success',
                message: 'Tin nhắn test Telegram đã được gửi thành công!',
                data: result.data,
            });
        }

        return res.status(400).json({
            status: 'error',
            message: `Không thể gửi tin nhắn Telegram: ${result.error}`,
        });
    } catch (error) {
        next(error);
    }
};
