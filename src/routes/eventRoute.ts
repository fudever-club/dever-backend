import express from 'express';
import {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    registerEvent,
    getMyEventTickets,
    getEventAttendees,
    checkInAttendee,
} from '../controllers/eventController';
import { requireAdmin, requireAuth, optionalAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/')
    .get(getAllEvents)
    .post(requireAuth, requireAdmin, createEvent);

Router.route('/my-tickets').get(requireAuth, getMyEventTickets);
Router.route('/checkin').post(requireAuth, requireAdmin, checkInAttendee);

Router.route('/:id')
    .get(getEventById)
    .patch(requireAuth, requireAdmin, updateEvent)
    .put(requireAuth, requireAdmin, updateEvent)
    .delete(requireAuth, requireAdmin, deleteEvent);

Router.route('/:id/register').post(optionalAuth, registerEvent);
Router.route('/:id/attendees').get(requireAuth, requireAdmin, getEventAttendees);

module.exports = Router;
