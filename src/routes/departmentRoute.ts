import express from 'express';

import {
    createDepartment,
    deleteDepartment,
    editDepartment,
    getAllDepartments,
    getDepartmentById,
} from '../controllers/departmentController';

const Router = express.Router();
Router.route('/').get(getAllDepartments);
Router.route('/:id').get(getDepartmentById);
Router.route('/').post(createDepartment);
Router.route('/:id').patch(editDepartment);
Router.route('/:id').delete(deleteDepartment);

module.exports = Router;
