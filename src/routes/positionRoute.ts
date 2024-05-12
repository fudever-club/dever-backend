import express from 'express';
import { createPosition } from '../controllers/positionController';

const Router = express.Router();
Router.route('/').post(createPosition);

module.exports = Router;
