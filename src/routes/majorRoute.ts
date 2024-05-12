import express from 'express';

import { createMajor } from '../controllers/majorController';

const Router = express.Router();
Router.route('/').post(createMajor);

module.exports = Router;
