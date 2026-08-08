import express from 'express';

import { changePassword, editProfile } from '../controllers/profileController';
import { requireAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/').patch(requireAuth, editProfile);
Router.route('/change-password').patch(requireAuth, changePassword);

module.exports = Router;
