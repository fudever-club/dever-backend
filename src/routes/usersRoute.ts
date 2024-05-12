import express from 'express';

import { editProfile, changePassword } from './../controllers/usersController';
import { getAllUsers, getUserById } from '../controllers/usersController';
import { verifyToken } from '../middlewares/veryfyToken';

const Router = express.Router();
Router.route('/').get(getAllUsers);
Router.route('/:userId').get(getUserById);
Router.route('/:userId').patch(editProfile);
Router.route('/edit/:userId').put(verifyToken, editProfile);
Router.route('/edit/:userId/password').put(verifyToken, changePassword);

module.exports = Router;
