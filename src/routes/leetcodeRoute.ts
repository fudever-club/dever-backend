import express from 'express';

import { getLeaderBoard, subcribeLeetcode, updateLeaderboard } from '../controllers/leetcodeController';

const Router = express.Router();
Router.route('/').get(getLeaderBoard);
Router.route('/subcribe').post(subcribeLeetcode);
Router.route('/update').get(updateLeaderboard);

module.exports = Router;
