import express from 'express';
import {
    listOpenSourceProjects,
    listAllOpenSourceProjectsForAdmin,
    createOpenSourceProject,
    updateOpenSourceProject,
    deleteOpenSourceProject,
} from '../controllers/openSourceController';
import { requireAuth, requireAdmin } from '../middlewares/auth';

const Router = express.Router();

Router.route('/').get(listOpenSourceProjects).post(requireAuth, requireAdmin, createOpenSourceProject);
Router.route('/admin/all').get(requireAuth, requireAdmin, listAllOpenSourceProjectsForAdmin);
Router.route('/:id')
    .put(requireAuth, requireAdmin, updateOpenSourceProject)
    .delete(requireAuth, requireAdmin, deleteOpenSourceProject);

module.exports = Router;
