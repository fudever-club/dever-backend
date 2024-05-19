import express from 'express';
import { deleteImage, deleteManyImages, getAllImages, insertManyImages } from '../controllers/imageActivityController';

const Router = express.Router();

Router.route('/').post(insertManyImages);
Router.route('/').get(getAllImages);
Router.route('/').delete(deleteManyImages);
Router.route('/:id').delete(deleteImage);

module.exports = Router;
