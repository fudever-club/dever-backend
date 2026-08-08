import express from 'express';

import {
    createDepartment,
    deleteDepartment,
    editDepartment,
    getAllDepartments,
    getDepartmentById,
} from '../controllers/departmentController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getAllDepartments);
Router.route('/:id').get(getDepartmentById);
Router.route('/').post(requireAuth, requireAdmin, createDepartment);
Router.route('/:id').patch(requireAuth, requireAdmin, editDepartment);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteDepartment);

module.exports = Router;
