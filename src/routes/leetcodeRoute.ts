import express from 'express';

import { getLeaderBoard, subcribeLeetcode, updateLeaderboard } from '../controllers/leetcodeController';
import { requireAdmin, requireAuth } from '../middlewares/auth';
import { cacheRoute } from '../services/cacheService';

const Router = express.Router();
Router.route('/').get(cacheRoute(60, 'leetcode'), getLeaderBoard);
Router.route('/leaderboard').get(cacheRoute(60, 'leetcode'), getLeaderBoard);
Router.route('/subcribe').post(requireAuth, subcribeLeetcode);
Router.route('/subscribe').post(requireAuth, subcribeLeetcode);
Router.route('/update').post(requireAuth, requireAdmin, updateLeaderboard);

module.exports = Router;
