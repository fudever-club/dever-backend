import express from 'express';
import {
    createPosition,
    deletePosition,
    editPosition,
    getAllPositions,
    getPositionById,
} from '../controllers/positionController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').post(requireAuth, requireAdmin, createPosition);
Router.route('/').get(getAllPositions);
Router.route('/:id').get(getPositionById);
Router.route('/:id').patch(requireAuth, requireAdmin, editPosition);
Router.route('/:id').delete(requireAuth, requireAdmin, deletePosition);

module.exports = Router;
