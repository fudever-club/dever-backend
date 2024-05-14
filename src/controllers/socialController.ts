import { Social } from './../models/SocialModel';
import { Request, Response, NextFunction } from 'express';

export const createSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, constant } = req.body;

        await Social.create({
            name,
            constant,
        });
        res.status(200).json({
            status: 'success',
            data: {
                name,
                constant,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getAllSocials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const socials = await Social.find({});
        console.log(socials);

        res.status(200).json({
            status: 'success',
            data: socials,
            length: socials?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getSocialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const social = await Social.findById(id);

        res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        next(err);
    }
};

export const editSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, constant } = req.body;

        const social = await Social.findByIdAndUpdate(id, {
            name,
            constant,
        });

        res.status(200).json({
            status: 'success',
            data: social,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteSocial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await Social.findByIdAndDelete(id);
        res.status(200).json({
            status: 'success',
            data: null,
        });
    } catch (err) {
        next(err);
    }
};
