import { Request, Response, NextFunction } from 'express';

export interface ErrorType {
    statusCode?: number;
    status?: number;
    code?: number;
    keyValue?: {};
    message: string;
    kind?: string;
}

exports.errorHandler = (err: ErrorType, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = res.statusCode = err.status || 500;
    // Duplication
    if (err.code === 11000) {
        err.statusCode = 400;
        for (let i in err.keyValue) {
            err.message = `${i} have to be unique!`;
        }

        // ObjectID: not found
        if (err.kind === 'ObjectId') {
            err.statusCode = 404;
            err.message = `The ${req.originalUrl} is not found because of wrong ID`;
        }

        // Validation
        //   if (err.errors) {
        //     err.statusCode = 400;
        //     err.message = [];
        //     for (let i in err.errors) {
        //       err.message.push(err.errors[i].message);
        //     }
        //   }

        res.status(err.statusCode).json({
            status: 'fail',
            message: err.message,
        });
    }
};
