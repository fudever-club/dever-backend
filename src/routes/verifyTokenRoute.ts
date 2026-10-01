import express from 'express';

import { editProfile, changePassword, deleteUser } from '../controllers/usersController';
import { getAllUsers, getUserById } from '../controllers/usersController';
import { verifyToken } from '../controllers/tokenController';
import { verifyTokenLimiter } from '../middlewares/rateLimit';

const Router = express.Router();
Router.route('/').post(verifyTokenLimiter, verifyToken);

module.exports = Router;
