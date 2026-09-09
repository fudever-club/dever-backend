import { Request, Response, NextFunction } from 'express';
import { observabilityService } from '../services/observabilityService';

export interface ErrorType {
    statusCode?: number;
    status?: number;
    code?: number;
    keyValue?: {};
    message: string;
    kind?: string;
    // errorArr: string[];
}

exports.errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        return next(err);
    }

    err.statusCode = res.statusCode = err.status || 500;
    console.error('[Error Handler]:', err);

    // Trigger Telegram Alert for Server 500s
    if (err.statusCode >= 500) {
        observabilityService.reportCriticalError({
            source: 'backend',
            message: err.message || 'Internal Server Error',
            stack: err.stack,
            route: req.originalUrl,
            method: req.method,
            statusCode: err.statusCode,
            user: res.locals?.auth?.email || res.locals?.auth?.userId?.toString(),
            ip: req.ip || req.headers['x-forwarded-for']?.toString(),
        }).catch((e) => console.warn('[Error Handler Alert Failed]:', e));
    }

    if (err.code === 11000) {
        err.statusCode = 400;
        for (let i in err.keyValue) {
            err.message = `Your is ${i} already exists`;
        }
    }

    // ObjectID: not found
    if (err.kind === 'ObjectId') {
        err.statusCode = 404;
        err.message = `The ${req.originalUrl} is not found because of wrong ID`;
    }

    // Validation
    if (err.errors) {
        err.statusCode = 400;
        err.message = [];
        for (let i in err.errors) {
            err.message.push(err.errors[i].message);
        }
    }
    console.log('err', err);

    res.status(err.statusCode).json({
        status: 'fail',
        message: err.message,
    });
};
