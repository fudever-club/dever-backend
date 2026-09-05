import { Request, Response, NextFunction } from 'express';
import { Album } from '../models/albumModel';

export const createAlbum = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên album là bắt buộc',
            });
        }

        const album = await Album.create({
            name: name.trim(),
            description: description?.trim() || '',
        });

        return res.status(201).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAllAlbums = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const albums = await Album.find({}).sort({ createdAt: -1 });

        const limitedAlbums = albums.map((album: any) => {
            const albumObject = album.toObject();
            albumObject.imageList = (albumObject.imageList || []).slice(0, 5);
            return albumObject;
        });

        return res.status(200).json({
            status: 'success',
            results: limitedAlbums.length,
            data: limitedAlbums,
            length: limitedAlbums.length,
        });
    } catch (err) {
        return next(err);
    }
};

export const getAlbumBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
        const skip = (page - 1) * limit;

        const album = await Album.findOne({ slug });

        if (!album) {
            return res.status(404).json({
                status: 'fail',
                message: 'Album không tồn tại',
            });
        }

        const totalImages = (album.imageList || []).length;
        const paginatedImages = album.imageList.slice(skip, skip + limit);

        return res.status(200).json({
            status: 'success',
            data: {
                album: {
                    ...album.toObject(),
                    imageList: paginatedImages,
                },
                pagination: {
                    totalImages,
                    currentPage: page,
                    totalPages: Math.ceil(totalImages / limit),
                    pageSize: limit,
                },
            },
        });
    } catch (err) {
        return next(err);
    }
};

export const editAlbumById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const album = await Album.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album không tồn tại để chỉnh sửa',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteAlbumBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;

        const album = await Album.findOneAndDelete({ slug });
        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album không tồn tại để xóa',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa album thành công',
        });
    } catch (err) {
        return next(err);
    }
};

export const addManyImageToAlbum = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const { imageList } = req.body;

        const album = await Album.findOne({ slug });
        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album không tồn tại',
            });
        }

        if (!Array.isArray(imageList) || !imageList.every((img) => typeof img?.url === 'string')) {
            return res.status(400).json({
                status: 'error',
                message: 'Định dạng danh sách ảnh không hợp lệ',
            });
        }

        album.imageList = imageList;
        await album.save();

        return res.status(200).json({
            status: 'success',
            message: 'Đã cập nhật danh sách ảnh vào album',
        });
    } catch (err) {
        return next(err);
    }
};

export const deleteManyImageAlbum = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const { imageUrls } = req.body;

        if (!Array.isArray(imageUrls) || !imageUrls.every((url) => typeof url === 'string')) {
            return res.status(400).json({
                status: 'error',
                message: 'Định dạng danh sách ảnh cần xóa không hợp lệ',
            });
        }

        const album = await Album.findOne({ slug });
        if (!album) {
            return res.status(404).json({
                status: 'error',
                message: 'Album không tồn tại',
            });
        }

        album.imageList = (album.imageList || []).filter((image: any) => !imageUrls.includes(image?.url));
        await album.save();

        return res.status(200).json({
            status: 'success',
            message: 'Đã xóa các ảnh khỏi album thành công',
        });
    } catch (err) {
        return next(err);
    }
};

export const getAlbumById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const album = await Album.findById(id);

        if (!album) {
            return res.status(404).json({
                status: 'fail',
                message: 'Album không tồn tại',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: album,
        });
    } catch (err) {
        return next(err);
    }
};
