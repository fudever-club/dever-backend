import express from 'express';

import { createSocial, deleteSocial, editSocial, getAllSocials, getSocialById } from '../controllers/socialController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').post(requireAuth, requireAdmin, createSocial);
Router.route('/').get(getAllSocials);
Router.route('/:id').get(getSocialById);
Router.route('/:id').patch(requireAuth, requireAdmin, editSocial);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteSocial);

module.exports = Router;
