import express from 'express';
import {
    getMyGamificationStats,
    dailyCheckin,
    getHallOfFame,
} from '../controllers/gamificationController';
import { requireAuth, optionalAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/my-stats').get(requireAuth, getMyGamificationStats);
Router.route('/daily-checkin').post(requireAuth, dailyCheckin);
Router.route('/hall-of-fame').get(optionalAuth, getHallOfFame);

module.exports = Router;
