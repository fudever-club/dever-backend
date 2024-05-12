import express from 'express';

import { createSocial } from '../controllers/socialController';

const Router = express.Router();
Router.route('/').post(createSocial);

module.exports = Router;
