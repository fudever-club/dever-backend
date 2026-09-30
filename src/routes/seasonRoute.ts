import express from 'express';
import {
    createSeason,
    getSeasonLeaderboard,
    getSeasons,
    updateSeason,
} from '../controllers/seasonController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();

// Public arena surfaces (opt-in members only, same privacy as the main board).
Router.route('/').get(getSeasons);
Router.route('/leaderboard').get(getSeasonLeaderboard);

// Admin season management.
Router.route('/').post(requireAuth, requireAdmin, createSeason);
Router.route('/:id').patch(requireAuth, requireAdmin, updateSeason);

module.exports = Router;
