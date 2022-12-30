const jwt = require('jsonwebtoken');
import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction, json } from 'express';

export const verifyToken = (err: ErrorType, req: Request, res: Response, next: NextFunction) => {
    console.log('!!!');

    const Authorization = req.header('authorization');
    if (!Authorization) {
        const err: ErrorType = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }
    const token = Authorization.replace('Bearer ', '');
    console.log(token);
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    console.log('success');
    // req.user = { userId };
    next();
};
