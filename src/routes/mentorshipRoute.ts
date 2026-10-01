import express from 'express';
import {
    getMentors,
    getMyMentorshipRequests,
    listMentorshipRequests,
    requestMentorship,
    reviewMentorshipRequest,
} from '../controllers/mentorshipController';
import { requireAdmin, requireAuth } from '../middlewares/auth';
import { mentorshipLimiter } from '../middlewares/rateLimit';

const Router = express.Router();

// Public mentor directory (published mentors, safe fields only).
Router.route('/mentors').get(getMentors);

// Authenticated member request flow.
Router.route('/mentors/:alumniId/request').post(requireAuth, mentorshipLimiter, requestMentorship);
Router.route('/requests/me').get(requireAuth, getMyMentorshipRequests);

// Admin moderation queue.
Router.route('/requests').get(requireAuth, requireAdmin, listMentorshipRequests);
Router.route('/requests/:id/review').patch(requireAuth, requireAdmin, reviewMentorshipRequest);

module.exports = Router;
