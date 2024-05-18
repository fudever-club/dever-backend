import express from 'express';

import { editProfile } from '../controllers/profileController';

const Router = express.Router();

Router.route('/').patch(editProfile);

module.exports = Router;
