import express from 'express';

import {
    addManyImageToAlbum,
    createAlbum,
    deleteAlbumBySlug,
    deleteManyImageAlbum,
    editAlbumById,
    getAlbumBySlug,
    getAllAlbums,
} from '../controllers/albumController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').post(requireAuth, requireAdmin, createAlbum);
Router.route('/').get(getAllAlbums);
Router.route('/:slug').get(getAlbumBySlug);
Router.route('/:id').patch(requireAuth, requireAdmin, editAlbumById);
Router.route('/:slug').delete(requireAuth, requireAdmin, deleteAlbumBySlug);
Router.route('/:slug').post(requireAuth, requireAdmin, addManyImageToAlbum);
Router.route('/:slug/delete-images').delete(requireAuth, requireAdmin, deleteManyImageAlbum);

module.exports = Router;
