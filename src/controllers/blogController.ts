import { Request, Response, NextFunction } from 'express';
import { Blog } from '../models/BlogModel';
import { User } from '../models/UserModel';

export const getAllBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blogs = await Blog.find({ status: 'published' }).sort({ createdAt: -1 });
        res.status(200).json({
            status: 'success',
            results: blogs.length,
            data: blogs,
        });
    } catch (error) {
        next(error);
    }
};

export const getBlogBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' });
        if (!blog) return res.status(404).json({ status: 'error', message: 'Blog not found' });
        return res.status(200).json({ status: 'success', data: blog });
    } catch (error) { return next(error); }
};

export const createBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const title = req.body.title || 'Bài viết mới';
        const slug = req.body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
        const authorUser = await User.findById(res.locals.auth?.userId).select('firstname lastname avatar');
        const { author: _untrustedAuthor, slug: _untrustedSlug, ...safeRequestBody } = req.body;
        
        const blogData = {
            ...safeRequestBody,
            slug,
            author: {
                name: [authorUser?.firstname, authorUser?.lastname].filter(Boolean).join(' ') || 'Ban quản trị DEVER',
                role: 'FU-DEVER Admin',
                avatar: authorUser?.avatar || '/images/avatar/avatar.jpg',
            },
        };

        const blog = await Blog.create(blogData);
        res.status(201).json({
            status: 'success',
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

export const likeBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );
        res.status(200).json({
            status: 'success',
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await Blog.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: 'success',
            message: 'Blog deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
