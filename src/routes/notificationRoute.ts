import express from 'express';
import {
    getMyNotifications,
    getMyNotificationPrefs,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    testTelegramBot,
    updateMyNotificationPrefs,
} from '../controllers/notificationController';
import { requireAuth, requireAdmin } from '../middlewares/auth';

const Router = express.Router();

Router.route('/my-notifications').get(requireAuth, getMyNotifications);
// Literal 'prefs' must register before '/:id' or it would be captured as an id.
Router.route('/prefs').get(requireAuth, getMyNotificationPrefs).put(requireAuth, updateMyNotificationPrefs);
Router.route('/read-all').put(requireAuth, markAllNotificationsAsRead);
Router.route('/:id/read').put(requireAuth, markNotificationAsRead);
Router.route('/:id').delete(requireAuth, deleteNotification);
Router.route('/test-telegram').post(requireAuth, requireAdmin, testTelegramBot);

module.exports = Router;
