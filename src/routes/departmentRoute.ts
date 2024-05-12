import express from 'express';

import { createDepartment } from '../controllers/departmentController';

const Router = express.Router();
Router.route('/').post(createDepartment);

module.exports = Router;
