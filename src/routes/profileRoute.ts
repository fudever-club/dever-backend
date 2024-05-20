import express from 'express';

import { changePassword, editProfile } from '../controllers/profileController';

const Router = express.Router();

Router.route('/').patch(editProfile);
Router.route('/change-password').patch(changePassword);

module.exports = Router;
