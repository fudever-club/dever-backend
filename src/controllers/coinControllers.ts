import { ErrorType } from './../middlewares/errorHandler';
import { Request, Response, NextFunction, json } from 'express';
import axios from 'axios';

export const getCoinLastest = async (req: Request, res: Response) => {
    let response = null;
    new Promise(async (resolve, reject) => {
        try {
            response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
                headers: {
                    'X-CMC_PRO_API_KEY': `${process.env.API_KEY}`,
                },
            });
        } catch (ex) {
            response = null;
            // error
            reject(ex);
        }
        if (response) {
            // success
            const json = response.data;
            res.json(json);
            resolve(json);
        }
    });
};

export const getCoinFiat = async (req: Request, res: Response) => {
    let response = null;
    new Promise(async (resolve, reject) => {
        try {
            response = await axios.get('https://pro-api.coinmarketcap.com/v1/fiat/map', {
                headers: {
                    'X-CMC_PRO_API_KEY': `${process.env.API_KEY}`,
                },
            });
        } catch (ex) {
            response = null;
            // error
            reject(ex);
        }
        if (response) {
            // success
            const json = response.data;
            res.json();
            resolve(json);
        }
    });
};
