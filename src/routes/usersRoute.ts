import express from 'express';
import { getAllUsers, getUserById } from '../controllers/usersController';

const Router = express.Router();
Router.route('/').get(getAllUsers);
Router.route('/:userId').get(getUserById);

module.exports = Router;
