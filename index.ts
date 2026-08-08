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
const { errorHandler } = require('./src/middlewares/errorHandler');

const { connectDB } = require('./src/config/db');

connectDB();

import express from 'express';
import cors from 'cors';
const mongoose = require('mongoose');

const app = express();
const server = require('http').Server(app);
// Railway injects PORT for the public proxy. APP_PORT remains a local
// development override when PORT is not supplied.
const port = Number(process.env.PORT || process.env.APP_PORT || 5000);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002,http://localhost:3003,http://127.0.0.1:3003')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // Server-to-server checks and same-origin requests do not include Origin.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Origin is not allowed by CORS'));
        },
    }),
);

app.use(express.json());

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

app.post('/api/v1/check-ip', (req, res) => {
    console.log(req.body);

    res.json(req.body);
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

// Register documentation before the catch-all 404 handler. Previously this
// function ran inside the listen callback, after the wildcard route had
// already captured /docs and /docs.json requests.
swaggerDocs(app, Number(port));

app.all('*', (req, res, next) => {
    const err: ErrorType = new Error('Unhandled Route');
    err.status = 404;
    next(err);
});

// app.use((error: any, req: any, res: any, next: any) => {
//     error.statusCode = error.statusCode || 500; // Changed to 500 for a more appropriate default error code
//     error.status = error.status || 'error';

//     res.status(error.statusCode).json({
//         status: error.status,
//         message: error.message,
//     });
// });

app.use('/api/v1/', errorHandler);

import { socketServer } from './src/socket';
socketServer.init(server);
socketServer.onConnection();
server.listen(port, () => {
    console.log(`connected to port successfully http://localhost:${port}/ `);
});
