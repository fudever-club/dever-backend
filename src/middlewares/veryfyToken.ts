const jwt = require('jsonwebtoken');
import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction, json } from 'express';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        next();
    } catch (error) {
        console.log('error');
        console.log(error);

        return res.status(400).json({
            error: {
                statusCode: 400,
                status: 'error',
                message: 'Token is invalid',
            },
        });
    }
};
