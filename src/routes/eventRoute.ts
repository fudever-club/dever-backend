import express from 'express';
import { getAllEvents, createEvent, deleteEvent } from '../controllers/eventController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getAllEvents).post(requireAuth, requireAdmin, createEvent);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteEvent);

module.exports = Router;
