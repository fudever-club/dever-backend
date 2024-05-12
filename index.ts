import { ErrorType } from './src/middlewares/errorHandler';

require('dotenv').config();

const authRoute = require('./src/routes/authRoute');
const usersRoute = require('./src/routes/usersRoute');
const socialRoute = require('./src/routes/socialRoute');
const majorRoute = require('./src/routes/majorRoute');
const departmentRoute = require('./src/routes/departmentRoute');
const positionRoute = require('./src/routes/positionRoute');
const { errorHandler } = require('./src/middlewares/errorHandler');

const { connectDB } = require('./src/config/db');

connectDB();

import express from 'express';
import cors from 'cors';

const app = express();
const server = require('http').Server(app);
const port = process.env.APP_PORT || 5000;

app.use(cors());

app.use(express.json());

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/users', usersRoute);

app.use('/api/v1/social', socialRoute);
app.use('/api/v1/major', majorRoute);
app.use('/api/v1/department', departmentRoute);
app.use('/api/v1/position', positionRoute);

app.all('*', (req, res, next) => {
    const err: ErrorType = new Error('Unhandled Route');
    err.statusCode = 404;
    next(err);
});

app.use('/api/v1/auth', errorHandler);

import { socketServer } from './src/socket';
socketServer.init(server);
socketServer.onConnection();
server.listen(port, () => {
    console.log(`connected to port successfully http://localhost:${port}/ `);
});
