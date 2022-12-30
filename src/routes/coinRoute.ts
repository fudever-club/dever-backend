import { getCoinLastest } from './../controllers/coinControllers';
import express from 'express';

const Router = express.Router();
Router.route('/latest').get(getCoinLastest);
// Router.route('/:userId').get(getUserById);

module.exports = Router;
