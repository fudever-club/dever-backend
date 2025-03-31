import express from 'express';

import {
    createProject,
    deleteProjectById,
    editProjectById,
    getAllProject,
    getProjectBySlug,
} from '../controllers/projectController';

const Router = express.Router();
Router.route('/').post(createProject);
Router.route('/').get(getAllProject);
Router.route('/:slug').get(getProjectBySlug);
Router.route('/:id').delete(deleteProjectById);
Router.route('/:id').patch(editProjectById);

module.exports = Router;
