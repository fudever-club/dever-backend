import express from 'express';
import { getAllResources, createResource, deleteResource, downloadResource } from '../controllers/resourceController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getAllResources).post(requireAuth, requireAdmin, createResource);
Router.route('/:id/download').get(downloadResource);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteResource);

module.exports = Router;
