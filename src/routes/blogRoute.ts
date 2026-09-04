import express from 'express';
import {
    getAllBlogs,
    getBlogBySlug,
    getMyBlogs,
    createBlog,
    updateBlog,
    deleteBlog,
    getReviewQueue,
    getAllBlogsForAdmin,
    toggleFeaturedBlog,
    reviewBlog,
    likeBlog,
} from '../controllers/blogController';
import { requireAdmin, requireAuth, optionalAuth } from '../middlewares/auth';

const Router = express.Router();

Router.route('/').get(getAllBlogs).post(requireAuth, createBlog);
Router.route('/me').get(requireAuth, getMyBlogs);
Router.route('/admin/all').get(requireAuth, requireAdmin, getAllBlogsForAdmin);
Router.route('/admin/review-queue').get(requireAuth, requireAdmin, getReviewQueue);
Router.route('/slug/:slug').get(optionalAuth, getBlogBySlug);
Router.route('/:id/review').patch(requireAuth, requireAdmin, reviewBlog);
Router.route('/:id/toggle-featured').patch(requireAuth, requireAdmin, toggleFeaturedBlog);
Router.route('/:id/like').put(optionalAuth, likeBlog);
Router.route('/:id').put(requireAuth, updateBlog).delete(requireAuth, deleteBlog);

module.exports = Router;

