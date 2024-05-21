import express from 'express';

import { createProject, deleteProjectById, getAllProject, getProjectBySlug } from '../controllers/projectController';

const Router = express.Router();
Router.route('/').post(createProject);
Router.route('/').get(getAllProject);
Router.route('/:slug').get(getProjectBySlug);
Router.route('/:id').delete(deleteProjectById);

module.exports = Router;
