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

const Router = express.Router();
Router.route('/').post(createAlbum);
Router.route('/').get(getAllAlbums);
Router.route('/:slug').get(getAlbumBySlug);
Router.route('/:id').patch(editAlbumById);
Router.route('/:slug').delete(deleteAlbumBySlug);
Router.route('/:slug').post(addManyImageToAlbum);
Router.route('/:slug/delete-images').delete(deleteManyImageAlbum);

module.exports = Router;
