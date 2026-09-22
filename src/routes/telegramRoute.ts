import express from 'express';
import { handleTelegramWebhook, reportClientError } from '../controllers/telegramWebhookController';
import { errorReportLimiter, telegramWebhookLimiter } from '../middlewares/rateLimit';

const Router = express.Router();

// 1. Telegram Interactive Bot Webhook
Router.post('/webhook', telegramWebhookLimiter, handleTelegramWebhook);

// 2. Client & Landing ErrorBoundary Telemetry ingestion
Router.post('/report-error', errorReportLimiter, reportClientError);

module.exports = Router;
