import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

import { User } from '../models/UserModel';
import { Department } from '../models/DepartmentModel';
import { Album } from '../models/albumModel';

export const createAlbum = async (req: Request, res: Response, next: NextFunction) => {
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

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { name, description } = req.body;

        const album = await Album.create({
            name,
            description,
        });
        res.status(200).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        next(err);
    }
};

export const getAllAlbums = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const albums = await Album.find({});
        res.status(200).json({
            status: 'success',
            data: albums,
            length: albums?.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getAlbumBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;

        const album = await Album.findOne({ slug });

        res.status(200).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        next(err);
    }
};

export const editAlbumById = async (req: Request, res: Response, next: NextFunction) => {
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

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { id } = req.params;
        console.log('🚀 ~ editAlbumById ~ id:', id);

        const album = await Album.findByIdAndUpdate(id, {
            ...req.body,
        });

        console.log(album);

        res.status(200).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteAlbumBySlug = async (req: Request, res: Response, next: NextFunction) => {
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

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            res.status(403).json({
                status: 'error',
                message: 'You are not allowed use this feature',
            });
        }

        const { slug } = req.params;

        await Album.deleteOne({ slug });

        res.status(200).json({
            status: 'success',
            message: 'Album deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};

export const addManyImageToAlbum = async (req: Request, res: Response, next: NextFunction) => {
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
        const { userId } = jwt.verify(token, process.env.APP_SECRET) as { userId: string };

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'You are not allowed to use this feature',
            });
        }

        const { slug } = req.params;
        const { imageList } = req.body;

        const album = await Album.findOne({ slug });

        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album not found',
            });
        }

        // Validate the imageList format
        if (!Array.isArray(imageList) || !imageList.every((img) => typeof img.url === 'string')) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid image list format',
            });
        }

        // Update the imageList
        album.imageList = imageList;
        await album.save();

        res.status(200).json({
            status: 'success',
            message: 'Images added successfully',
        });
    } catch (err) {
        next(err);
    }
};

export const deleteManyImageAlbum = async (req: Request, res: Response, next: NextFunction) => {
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
        const { userId } = jwt.verify(token, process.env.APP_SECRET) as { userId: string };

        const user = await User.findById(userId);

        if (!user?.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'You are not allowed to use this feature',
            });
        }

        const { slug } = req.params;
        const { imageUrls } = req.body;

        if (!Array.isArray(imageUrls) || !imageUrls.every((url) => typeof url === 'string')) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid image URLs format',
            });
        }

        const album = await Album.findOne({ slug });

        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album not found',
            });
        }

        // Filter out the images that are in the imageUrls array
        console.log('🚀 ~ deleteManyImageAlbum ~ album.imageList:', album.imageList);
        album.imageList = album.imageList.filter((image: any) => !imageUrls.includes(image?.url));
        await album.save();

        res.status(200).json({
            status: 'success',
            message: 'Images deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};
