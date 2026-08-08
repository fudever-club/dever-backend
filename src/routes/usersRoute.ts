import express from 'express';
import {
    changePassword,
    createManyUsersByCsv,
    createMember,
    deleteUser,
    editProfile,
    getAllUsers,
    getUserById,
    resetPasword,
} from '../controllers/usersController';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/').get(optionalAuth, getAllUsers).post(requireAuth, requireAdmin, createMember);
Router.route('/csv').post(requireAuth, requireAdmin, createManyUsersByCsv);
Router.route('/:userId')
    .get(optionalAuth, getUserById)
    .patch(requireAuth, requireAdmin, editProfile)
    .delete(requireAuth, requireAdmin, deleteUser);
Router.route('/edit/:userId').put(requireAuth, requireAdmin, editProfile);
Router.route('/edit/:userId/password').put(requireAuth, changePassword);
Router.route('/reset-password/:userId').patch(requireAuth, requireAdmin, resetPasword);

module.exports = Router;
