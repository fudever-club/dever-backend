import express from 'express';

import {
    editProfile,
    changePassword,
    deleteUser,
    createManyUsersByCsv,
    resetPasword,
} from './../controllers/usersController';
import { getAllUsers, getUserById } from '../controllers/usersController';
import { verifyToken } from '../middlewares/veryfyToken';

const Router = express.Router();
Router.route('/').get(getAllUsers);
Router.route('/csv').post(createManyUsersByCsv);
Router.route('/:userId').get(getUserById);
Router.route('/:userId').patch(editProfile);
Router.route('/:userId').delete(deleteUser);
Router.route('/edit/:userId').put(verifyToken, editProfile);
Router.route('/edit/:userId/password').put(verifyToken, changePassword);
Router.route('/reset-password/:userId').patch(verifyToken, resetPasword);

module.exports = Router;
