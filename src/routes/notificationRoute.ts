import express from 'express';
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    testTelegramBot,
} from '../controllers/notificationController';
import { requireAuth, requireAdmin } from '../middlewares/auth';

const Router = express.Router();

Router.route('/my-notifications').get(requireAuth, getMyNotifications);
Router.route('/read-all').put(requireAuth, markAllNotificationsAsRead);
Router.route('/:id/read').put(requireAuth, markNotificationAsRead);
Router.route('/:id').delete(requireAuth, deleteNotification);
Router.route('/test-telegram').post(requireAuth, requireAdmin, testTelegramBot);

module.exports = Router;
