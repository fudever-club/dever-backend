import express from 'express';
import { getAllBlogs, getBlogBySlug, createBlog, likeBlog, deleteBlog } from '../controllers/blogController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const Router = express.Router();
Router.route('/').get(getAllBlogs).post(requireAuth, requireAdmin, createBlog);
Router.route('/slug/:slug').get(getBlogBySlug);
Router.route('/:id').delete(requireAuth, requireAdmin, deleteBlog);
Router.route('/:id/like').put(requireAuth, likeBlog);

module.exports = Router;
