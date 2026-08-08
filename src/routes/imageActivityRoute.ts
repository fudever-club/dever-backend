import express from 'express';
import { deleteImage, deleteManyImages, getAllImages, insertManyImages } from '../controllers/imageActivityController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/').post(requireAuth, requireAdmin, insertManyImages);
Router.route('/').get(getAllImages);
Router.route('/').delete(requireAuth, requireAdmin, deleteManyImages);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteImage);

module.exports = Router;
