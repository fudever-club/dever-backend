import express from 'express';

import {
    createProject,
    deleteProjectById,
    editProjectById,
    getAllProject,
    getProjectBySlug,
} from '../controllers/projectController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').post(requireAuth, requireAdmin, createProject);
Router.route('/').get(getAllProject);
Router.route('/:slug').get(getProjectBySlug);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteProjectById);
Router.route('/:id').patch(requireAuth, requireAdmin, editProjectById);

module.exports = Router;
