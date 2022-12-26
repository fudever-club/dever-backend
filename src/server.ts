import { ErrorType } from './middlewares/errorHandler';

require('dotenv').config();

const { connectDB } = require('./config/db');
connectDB();

const authRoute = require('./routes/authRoute');
const { errorHandler } = require('./middlewares/errorHandler');

import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.APP_PORT || 5000;

app.use(cors());

app.use(express.json());

app.use('/api/v1/auth', authRoute);

app.all('*', (req, res, next) => {
    const err: ErrorType = new Error('Unhandled Route');
    err.statusCode = 404;
    next(err);
});
app.use('/api/v1/auth', errorHandler);

app.get('/', (req, res, next) => {
    res.status(200).json({
        status: 'OK',
        data: 'Hello world',
    });
});

app.listen(port, () => {
    console.log(`connected to port successfully http://localhost:${port}/ `);
});
