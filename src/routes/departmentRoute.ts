import express from 'express';

import { createDepartment, getAllDepartments } from '../controllers/departmentController';

const Router = express.Router();
Router.route('/').get(getAllDepartments);
Router.route('/').post(createDepartment);

module.exports = Router;
