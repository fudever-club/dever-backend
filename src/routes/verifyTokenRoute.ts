import express from 'express';

import { editProfile, changePassword, deleteUser } from '../controllers/usersController';
import { getAllUsers, getUserById } from '../controllers/usersController';
import { verifyToken } from '../controllers/tokenController';

const Router = express.Router();
Router.route('/').post(verifyToken);

module.exports = Router;
