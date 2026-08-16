import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/NotificationModel';
import { testTelegramBotConnection } from '../services/telegramService';

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

        const orConditions: any[] = [
            { recipientId: new mongoose.Types.ObjectId(userId) },
            { recipientRole: 'all' },
        ];

        if (isAdmin) {
            orConditions.push({ recipientRole: 'admin' });
        }

        const query = { $or: orConditions };

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments(query),
            Notification.countDocuments({ ...query, isRead: false }),
        ]);

        return res.status(200).json({
            status: 'success',
            results: notifications.length,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a single notification as read
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

        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ status: 'error', message: 'Notification not found' });
        }

        return res.status(200).json({
            status: 'success',
            data: notification,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all notifications for the user as read
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        const orConditions: any[] = [
            { recipientId: new mongoose.Types.ObjectId(userId) },
            { recipientRole: 'all' },
        ];

        if (isAdmin) {
            orConditions.push({ recipientRole: 'admin' });
        }

        await Notification.updateMany({ $or: orConditions, isRead: false }, { isRead: true });

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

        return res.status(200).json({
            status: 'success',
            message: 'Notification deleted successfully',
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
