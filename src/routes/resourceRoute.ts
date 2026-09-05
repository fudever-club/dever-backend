import express from 'express';
import {
    getAllResources,
    createResource,
    deleteResource,
    downloadResource,
    toggleResourceFeatured,
    updateResource,
} from '../controllers/resourceController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getAllResources).post(requireAuth, requireAdmin, createResource);
Router.route('/:id/download').get(downloadResource);
Router.route('/:id/featured').patch(requireAuth, requireAdmin, toggleResourceFeatured);
Router.route('/:id')
    .patch(requireAuth, requireAdmin, updateResource)
    .put(requireAuth, requireAdmin, updateResource)
    .delete(requireAuth, requireAdmin, deleteResource);

module.exports = Router;
