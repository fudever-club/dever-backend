import express from 'express';
import { acceptInvite, validateInvite } from '../controllers/inviteController';
import { inviteLimiter } from '../middlewares/rateLimit';

const Router = express.Router();

// Public invite surface (no self-registration: a valid admin-minted token
// is required). Strict per-IP budget so tokens cannot be enumerated.
Router.route('/:token').get(inviteLimiter, validateInvite);
Router.route('/:token/accept').post(inviteLimiter, acceptInvite);

module.exports = Router;
