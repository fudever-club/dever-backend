import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Blog } from '../models/BlogModel';
import { User } from '../models/UserModel';
import { createNotification } from '../services/notificationService';

const calculateReadTime = (content: string): string => {
    if (!content) return '1 phút đọc';
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} phút đọc`;
};

export const getAllBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { category, tag, search, featured } = req.query;
        const filter: any = { status: 'published' };

        if (featured === 'true') {
            filter.isFeatured = true;
        }

        if (category && category !== 'All') {
            filter.category = category;
        }
        if (tag) {
            filter.tags = tag;
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
            ];
        }

        const blogs = await Blog.find(filter)
            .populate('authorId', 'firstname lastname avatar')
            .sort({ isFeatured: -1, createdAt: -1 });

        const mappedBlogs = blogs.map((b: any) => {
            const blogObj = b.toObject ? b.toObject() : b;
            if (b.authorId && typeof b.authorId === 'object') {
                const user = b.authorId;
                const liveName = [user.firstname, user.lastname].filter(Boolean).join(' ');
                if (liveName) blogObj.author = { ...blogObj.author, name: liveName };
                if (user.avatar) blogObj.author = { ...blogObj.author, avatar: user.avatar };
            }
            return blogObj;
        });

        res.status(200).json({
            status: 'success',
            results: mappedBlogs.length,
            data: mappedBlogs,
        });
    } catch (error) {
        next(error);
    }
};

export const getBlogBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const auth = res.locals.auth;
        const rawParam = req.params.slug;
        
        let blog = await Blog.findOne({ slug: rawParam }).populate('authorId', 'firstname lastname avatar');

        if (!blog) {
            try {
                const decoded = decodeURIComponent(rawParam);
                blog = await Blog.findOne({ slug: decoded }).populate('authorId', 'firstname lastname avatar');
            } catch (e) {}
        }

        if (!blog && mongoose.Types.ObjectId.isValid(rawParam)) {
            blog = await Blog.findById(rawParam).populate('authorId', 'firstname lastname avatar');
        }

        if (!blog) return res.status(404).json({ status: 'error', message: 'Blog not found' });

        // If unpublished, only author or admin can view
        if (blog.status !== 'published') {
            const isAuthor = auth?.userId && blog.authorId && (blog.authorId._id ? blog.authorId._id.toString() : blog.authorId.toString()) === auth.userId.toString();
            const isAdmin = Boolean(auth?.isAdmin);
            if (!isAuthor && !isAdmin) {
                return res.status(404).json({ status: 'error', message: 'Blog not found' });
            }
        }

        const blogObj = blog.toObject ? blog.toObject() : blog;
        if (blog.authorId && typeof blog.authorId === 'object') {
            const user = blog.authorId;
            const liveName = [user.firstname, user.lastname].filter(Boolean).join(' ');
            if (liveName) blogObj.author = { ...blogObj.author, name: liveName };
            if (user.avatar) blogObj.author = { ...blogObj.author, avatar: user.avatar };
        }

        return res.status(200).json({ status: 'success', data: blogObj });
    } catch (error) { return next(error); }
};

export const getMyBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        const blogs = await Blog.find({ authorId: userId }).sort({ updatedAt: -1 });
        return res.status(200).json({
            status: 'success',
            results: blogs.length,
            data: blogs,
        });
    } catch (error) {
        next(error);
    }
};

export const createBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        const title = (req.body.title || 'Bài viết mới').trim();
        const baseSlug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        const slug = (baseSlug || 'post') + '-' + Date.now().toString(36);

        const authorUser = await User.findById(userId).select('firstname lastname avatar positionId');
        const authorName = [authorUser?.firstname, authorUser?.lastname].filter(Boolean).join(' ') || 'Thành viên DEVER';
        const authorRole = isAdmin ? 'Ban Quản Trị' : 'Thành viên DEVER';

        const { author: _untrustedAuthor, slug: _untrustedSlug, ...safeRequestBody } = req.body;
        
        // Members submit as draft or pending_review; Admins can publish directly if status is 'published'
        let initialStatus = 'draft';
        if (req.body.status === 'pending_review' || req.body.status === 'draft') {
            initialStatus = req.body.status;
        } else if (isAdmin && req.body.status === 'published') {
            initialStatus = 'published';
        } else if (!isAdmin && req.body.submitForReview) {
            initialStatus = 'pending_review';
        }

        const blogData = {
            ...safeRequestBody,
            title,
            slug,
            content: req.body.content || '',
            excerpt: req.body.excerpt || (req.body.content ? req.body.content.slice(0, 150) + '...' : ''),
            category: req.body.category || 'Web & Frontend',
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            readTime: calculateReadTime(req.body.content || ''),
            authorId: userId,
            author: {
                name: authorName,
                role: authorRole,
                avatar: authorUser?.avatar || '/images/avatar/avatar.jpg',
            },
            status: initialStatus,
            reviewNotes: '',
        };

        const blog = await Blog.create(blogData);

        // If submitted for review, notify Admin via In-App Notification and Telegram Bot
        if (initialStatus === 'pending_review') {
            createNotification({
                recipientRole: 'admin',
                type: 'blog_submitted',
                title: 'Có bài viết mới gửi duyệt 📝',
                message: `Thành viên ${authorName} vừa gửi bài viết "${blog.title}" lên hàng đợi duyệt.`,
                link: '/vi/blog-management',
                meta: { blog, author: { name: authorName, email: (authorUser as any)?.email } },
                sendTelegram: true,
            }).catch((e) => console.warn('[Blog Notification Trigger Error]:', e));
        }

        res.status(201).json({
            status: 'success',
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

export const updateBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ status: 'error', message: 'Blog not found' });
        }

        const isAuthor = blog.authorId && blog.authorId.toString() === userId?.toString();
        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'Permission denied' });
        }

        // Author can only update draft or changes_requested posts
        if (!isAdmin && isAuthor && blog.status !== 'draft' && blog.status !== 'changes_requested') {
            return res.status(400).json({
                status: 'error',
                message: 'Không thể chỉnh sửa bài viết đang trong quá trình chờ duyệt hoặc đã xuất bản',
            });
        }

        const updates: any = {};
        if (req.body.title) updates.title = req.body.title;
        if (req.body.content !== undefined) {
            updates.content = req.body.content;
            updates.readTime = calculateReadTime(req.body.content);
        }
        if (req.body.excerpt !== undefined) updates.excerpt = req.body.excerpt;
        if (req.body.category !== undefined) updates.category = req.body.category;
        if (req.body.tags !== undefined) updates.tags = req.body.tags;
        if (req.body.coverImage !== undefined) updates.coverImage = req.body.coverImage;

        if (req.body.status) {
            if (isAdmin) {
                updates.status = req.body.status;
            } else if (['draft', 'pending_review'].includes(req.body.status)) {
                updates.status = req.body.status;
            }
        }

        const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updates, { new: true });
        return res.status(200).json({
            status: 'success',
            data: updatedBlog,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleFeaturedBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ status: 'error', message: 'Blog not found' });
        }

        const newFeatured = !blog.isFeatured;
        blog.isFeatured = newFeatured;
        await blog.save();

        return res.status(200).json({
            status: 'success',
            message: newFeatured ? 'Đã ghim bài viết lên mục nổi bật' : 'Đã bỏ ghim bài viết khỏi mục nổi bật',
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

export const getAllBlogsForAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, category, search } = req.query;
        const filter: any = {};

        if (status && status !== 'all') {
            if (status === 'featured') {
                filter.isFeatured = true;
            } else {
                filter.status = status;
            }
        }
        if (category && category !== 'All' && category !== 'Tất cả') {
            filter.category = category;
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { 'author.name': { $regex: search, $options: 'i' } },
            ];
        }

        const blogs = await Blog.find(filter)
            .populate('authorId', 'firstname lastname avatar email')
            .sort({ isFeatured: -1, updatedAt: -1, createdAt: -1 });

        const mappedBlogs = blogs.map((b: any) => {
            const blogObj = b.toObject ? b.toObject() : b;
            if (b.authorId && typeof b.authorId === 'object') {
                const user = b.authorId;
                const liveName = [user.firstname, user.lastname].filter(Boolean).join(' ');
                if (liveName) blogObj.author = { ...blogObj.author, name: liveName };
                if (user.avatar) blogObj.author = { ...blogObj.author, avatar: user.avatar };
            }
            return blogObj;
        });

        return res.status(200).json({
            status: 'success',
            results: mappedBlogs.length,
            data: mappedBlogs,
        });
    } catch (error) {
        next(error);
    }
};

export const getReviewQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blogs = await Blog.find({
            status: { $in: ['pending_review', 'changes_requested', 'draft'] },
        }).sort({ updatedAt: -1 });

        res.status(200).json({
            status: 'success',
            results: blogs.length,
            data: blogs,
        });
    } catch (error) {
        next(error);
    }
};

export const reviewBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, reviewNotes } = req.body;
        if (!['published', 'changes_requested', 'rejected'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid review status. Must be published, changes_requested, or rejected',
            });
        }

        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewNotes: reviewNotes || '',
                reviewedBy: res.locals.auth?.userId,
                reviewedAt: new Date(),
            },
            { new: true }
        );

        if (!blog) {
            return res.status(404).json({ status: 'error', message: 'Blog not found' });
        }

        // Handle Notifications, EXP rewards, and Telegram alerts based on status
        if (blog.authorId) {
            if (status === 'published') {
                // 1. Award author +100 EXP and unlock pro_tech_author badge
                await User.findByIdAndUpdate(blog.authorId, {
                    $inc: { exp: 100 },
                    $addToSet: {
                        unlockedBadges: { badgeId: 'pro_tech_author', unlockedAt: new Date() },
                    },
                });

                // 2. Notify author
                createNotification({
                    recipientId: blog.authorId.toString(),
                    type: 'blog_approved',
                    title: 'Bài viết của bạn đã được xuất bản! 🎉',
                    message: `Bài viết "${blog.title}" đã được duyệt thành công (+100 EXP và Huy hiệu Tác giả).`,
                    link: `/blog/${blog.slug}`,
                    meta: { blog, status, reviewNotes },
                    sendTelegram: true,
                }).catch((e) => console.warn('[Review Notification Error]:', e));
            } else if (status === 'changes_requested') {
                createNotification({
                    recipientId: blog.authorId.toString(),
                    type: 'blog_changes_requested',
                    title: 'Yêu cầu chỉnh sửa bài viết ⚠️',
                    message: `Bài viết "${blog.title}" cần chỉnh sửa: ${reviewNotes || 'Vui lòng kiểm tra lại nội dung.'}`,
                    link: '/vi/create-blog',
                    meta: { blog, status, reviewNotes },
                    sendTelegram: true,
                }).catch((e) => console.warn('[Review Notification Error]:', e));
            } else if (status === 'rejected') {
                createNotification({
                    recipientId: blog.authorId.toString(),
                    type: 'blog_rejected',
                    title: 'Bài viết không được phê duyệt ❌',
                    message: `Bài viết "${blog.title}" đã bị từ chối: ${reviewNotes || 'Nội dung chưa phù hợp tiêu chuẩn.'}`,
                    link: '/vi/create-blog',
                    meta: { blog, status, reviewNotes },
                    sendTelegram: true,
                }).catch((e) => console.warn('[Review Notification Error]:', e));
            }
        }

        res.status(200).json({
            status: 'success',
            message: `Bài viết đã được cập nhật trạng thái: ${status}`,
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

export const likeBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ status: 'error', message: 'Blog not found' });
        }

        let isLiked = false;
        if (userId && Array.isArray(blog.likedUsers)) {
            const index = blog.likedUsers.findIndex((id: any) => id.toString() === userId.toString());
            if (index > -1) {
                blog.likedUsers.splice(index, 1);
                blog.likes = Math.max(0, blog.likes - 1);
                isLiked = false;
            } else {
                blog.likedUsers.push(userId);
                blog.likes += 1;
                isLiked = true;
            }
        } else {
            blog.likes += 1;
            isLiked = true;
        }

        await blog.save();
        res.status(200).json({
            status: 'success',
            data: {
                likes: blog.likes,
                isLiked,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const deleteBlog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const isAdmin = Boolean(res.locals.auth?.isAdmin);

        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ status: 'error', message: 'Blog not found' });
        }

        const isAuthor = blog.authorId && blog.authorId.toString() === userId?.toString();
        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'Permission denied' });
        }

        await Blog.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: 'success',
            message: 'Blog deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

