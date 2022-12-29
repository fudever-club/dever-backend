import { ErrorType } from './middlewares/errorHandler';

require('dotenv').config();

const authRoute = require('./routes/authRoute');
const followRoute = require('./routes/followRoute');
const usersRoute = require('./routes/usersRoute');
const { errorHandler } = require('./middlewares/errorHandler');
const { connectDB } = require('./config/db');
connectDB();

import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.APP_PORT || 5000;

app.use(cors());

app.use(express.json());

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/follow', followRoute);
app.use('/api/v1/users', usersRoute);

app.all('*', (req, res, next) => {
    const err: ErrorType = new Error('Unhandled Route');
    err.statusCode = 404;
    next(err);
});
app.use('/api/v1/auth', errorHandler);

app.listen(port, () => {
    console.log(`connected to port successfully http://localhost:${port}/ `);
});
