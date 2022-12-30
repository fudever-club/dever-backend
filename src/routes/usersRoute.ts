import { editProfile } from './../controllers/usersController';
import express from 'express';
import { getAllUsers, getUserById } from '../controllers/usersController';
import { verifyToken } from '../middlewares/veryfyToken';

const Router = express.Router();
Router.route('/').get(getAllUsers);
Router.route('/:userId').get(verifyToken, getUserById);
Router.route('/edit/:userId').put(verifyToken, editProfile);

module.exports = Router;
