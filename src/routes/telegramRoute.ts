import express from 'express';
import { handleTelegramWebhook, reportClientError } from '../controllers/telegramWebhookController';

const Router = express.Router();

// 1. Telegram Interactive Bot Webhook
Router.post('/webhook', handleTelegramWebhook);

// 2. Client & Landing ErrorBoundary Telemetry ingestion
Router.post('/report-error', reportClientError);

module.exports = Router;
