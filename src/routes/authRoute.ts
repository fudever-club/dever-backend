import express from 'express';

import { register, login } from '../controllers/authController';

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
Router.route('/register').post(register);
Router.route('/login').post(login);

module.exports = Router;
