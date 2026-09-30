import express from 'express';

import { login, logout, refresh, revokeAll, welcome } from '../controllers/authController';
import { loginLimiter, refreshLimiter } from '../middlewares/rateLimit';
import { requireAuth } from '../middlewares/auth';

const Router = express.Router();

/**
 * @openapi
 * '/api/users':
 *  post:
 *     tags:
 *     - User
 *     summary: Register a user
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *               type: object
 *               properties:
 *                       id:
 *                         type: integer
 *                         description: The user ID.
 *                         example: 0
 *                       name:
 *                         type: string
 *                         description: The user's name.
 *                         example: Leanne Graham
 *     responses:
 *       200:
 *         description: A list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The user ID.
 *                         example: 0
 *                       name:
 *                         type: string
 *                         description: The user's name.
 *                         example: Leanne Graham
 */
Router.route('/').get(welcome);
Router.route('/login').post(loginLimiter, login);
Router.route('/refresh').post(refreshLimiter, refresh);
Router.route('/logout').post(logout);
Router.route('/revoke-all').post(requireAuth, revokeAll);

module.exports = Router;
