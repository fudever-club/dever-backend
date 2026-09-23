import { ErrorType } from './src/middlewares/errorHandler';
import swaggerDocs from './src/Utils/swagger';

require('dotenv').config();

const authRoute = require('./src/routes/authRoute');
const usersRoute = require('./src/routes/usersRoute');
const socialRoute = require('./src/routes/socialRoute');
const majorRoute = require('./src/routes/majorRoute');
const departmentRoute = require('./src/routes/departmentRoute');
const positionRoute = require('./src/routes/positionRoute');
const verifyTokenRoute = require('./src/routes/verifyTokenRoute');
const profileRoute = require('./src/routes/profileRoute');
const leetcodeRoute = require('./src/routes/leetcodeRoute');
const imageActivityRoute = require('./src/routes/imageActivityRoute');
const projectRoute = require('./src/routes/projectRoute');
const albumRoute = require('./src/routes/albumRoute');
const eventRoute = require('./src/routes/eventRoute');
const resourceRoute = require('./src/routes/resourceRoute');
const blogRoute = require('./src/routes/blogRoute');
const projectLabRoute = require('./src/routes/projectLabRoute');
const alumniRoute = require('./src/routes/alumniRoute');
const uploadRoute = require('./src/routes/uploadRoute');
const searchRoute = require('./src/routes/searchRoute');
const openSourceRoute = require('./src/routes/openSourceRoute');
const gamificationRoute = require('./src/routes/gamificationRoute');
const notificationRoute = require('./src/routes/notificationRoute');
const fundRoute = require('./src/routes/fundRoute');
const telegramRoute = require('./src/routes/telegramRoute');
import { observabilityService } from './src/services/observabilityService';
const { errorHandler } = require('./src/middlewares/errorHandler');

const { connectDB } = require('./src/config/db');

connectDB();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
const mongoose = require('mongoose');

import { createCorsOptions } from './src/config/cors';

const app = express();
// Behind Railway/Vercel proxies so req.secure reflects the real scheme.
app.set('trust proxy', 1);
const server = require('http').Server(app);
// Railway injects PORT for the public proxy. APP_PORT remains a local
// development override when PORT is not supplied.
const port = Number(process.env.PORT || process.env.APP_PORT || 5000);

// Exact-match origin policy lives in src/config/cors.ts. Preview or tenant
// deployments not on the built-in roster must be added explicitly through
// the CORS_ORIGINS environment variable — never via domain wildcards.
app.use(cors(createCorsOptions()));

// Resource uploads are stored as encoded document bytes. Keep this below the
// MongoDB document limit while allowing the 8 MB file limit enforced by the
// resource controller after base64 encoding.
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

// Liveness is intentionally independent of MongoDB so load balancers can tell
// that the process is running while the database is reconnecting.
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Readiness requires an active MongoDB connection, without exposing any
// connection details or other configuration values.
app.get('/ready', (_req, res) => {
    const isReady = mongoose.connection.readyState === 1;
    res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready' });
});

app.use('/', authRoute);
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/users', usersRoute);
app.use('/api/v1/edit-profile', profileRoute);

app.use('/api/v1/social', socialRoute);
app.use('/api/v1/major', majorRoute);
app.use('/api/v1/department', departmentRoute);
app.use('/api/v1/position', positionRoute);
app.use('/api/v1/verifyToken', verifyTokenRoute);
app.use('/api/v1/leetcode', leetcodeRoute);
app.use('/api/v1/image-activity', imageActivityRoute);
app.use('/api/v1/project', projectRoute);
app.use('/api/v1/album', albumRoute);
app.use('/api/v1/event', eventRoute);
app.use('/api/v1/events', eventRoute);
app.use('/api/v1/resource', resourceRoute);
app.use('/api/v1/resources', resourceRoute);
app.use('/api/v1/blog', blogRoute);
app.use('/api/v1/blogs', blogRoute);
app.use('/api/v1/project-lab', projectLabRoute);
app.use('/api/v1/alumni', alumniRoute);
app.use('/api/v1/opensource-projects', openSourceRoute);
app.use('/api/v1/open-source', openSourceRoute);
app.use('/api/v1/gamification', gamificationRoute);
app.use('/api/v1/notifications', notificationRoute);
app.use('/api/v1/funds', fundRoute);
app.use('/api/v1/fund', fundRoute);
app.use('/api/v1/upload', uploadRoute);
app.use('/api/v1/search', searchRoute);
app.use('/api/v1/telegram', telegramRoute);
app.use('/api/v1/telemetry', telegramRoute);

// Register documentation before the catch-all 404 handler. Previously this
// function ran inside the listen callback, after the wildcard route had
// already captured /docs and /docs.json requests.
swaggerDocs(app, Number(port));

app.all('*', (req, res, next) => {
    const err: ErrorType = new Error(`Unhandled Route: ${req.method} ${req.originalUrl}`);
    err.status = 404;
    next(err);
});

// Mount global error handler across all API routes and catch-all 404
app.use(errorHandler);

// Global process resilience against unhandled promises and exceptions
process.on('unhandledRejection', (reason: any) => {
    console.error('[Process] Unhandled Rejection:', reason);
    observabilityService.reportCriticalError({
        source: 'process',
        message: `Unhandled Rejection: ${reason?.message || String(reason)}`,
        stack: reason?.stack,
    }).catch(() => {});
});

process.on('uncaughtException', (error: Error) => {
    console.error('[Process] Uncaught Exception:', error);
    observabilityService.reportCriticalError({
        source: 'process',
        message: `Uncaught Exception: ${error?.message || String(error)}`,
        stack: error?.stack,
    }).catch(() => {});
});

import { socketServer } from './src/socket';
import { startTelegramPolling } from './src/services/telegramPollingService';

socketServer.init(server);
socketServer.onConnection();
server.listen(port, () => {
    console.log(`connected to port successfully http://localhost:${port}/ `);
    // Start Telegram polling to automatically receive & reply to admin commands
    startTelegramPolling();
});
