import express from 'express';

import { getLeaderBoard, subcribeLeetcode, updateLeaderboard } from '../controllers/leetcodeController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getLeaderBoard);
Router.route('/subcribe').post(requireAuth, subcribeLeetcode);
Router.route('/update').post(requireAuth, requireAdmin, updateLeaderboard);

module.exports = Router;
