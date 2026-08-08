import express from 'express';

import { createMajor, deleteMajor, editMajor, getAllMajors, getMajorById } from '../controllers/majorController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').post(requireAuth, requireAdmin, createMajor);
Router.route('/').get(getAllMajors);
Router.route('/:id').get(getMajorById);
Router.route('/:id').patch(requireAuth, requireAdmin, editMajor);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteMajor);

module.exports = Router;
