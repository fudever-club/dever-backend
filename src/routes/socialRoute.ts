import express from 'express';

import { createSocial, deleteSocial, editSocial, getAllSocials, getSocialById } from '../controllers/socialController';

const Router = express.Router();
Router.route('/').post(createSocial);
Router.route('/').get(getAllSocials);
Router.route('/:id').get(getSocialById);
Router.route('/:id').patch(editSocial);
Router.route('/:id').delete(deleteSocial);

module.exports = Router;
