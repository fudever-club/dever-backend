import express from 'express';
import {
    createPosition,
    deletePosition,
    editPosition,
    getAllPositions,
    getPositionById,
} from '../controllers/positionController';

const Router = express.Router();
Router.route('/').post(createPosition);
Router.route('/').get(getAllPositions);
Router.route('/:id').get(getPositionById);
Router.route('/:id').patch(editPosition);
Router.route('/:id').delete(deletePosition);

module.exports = Router;
