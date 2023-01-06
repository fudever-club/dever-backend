import { getCoinLastest, getCategories } from './../controllers/coinControllers';
import express from 'express';

const Router = express.Router();
Router.route('/latest').get(getCoinLastest);
Router.route('/categories').get(getCategories);
// Router.route('/:userId').get(getUserById);

module.exports = Router;
