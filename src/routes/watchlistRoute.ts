import { followOneToken, getWatchlistById } from './../controllers/watchlistController';
import express from 'express';

const Router = express.Router();
Router.route('/').post(followOneToken);
Router.route('/:userId').get(getWatchlistById);

module.exports = Router;
