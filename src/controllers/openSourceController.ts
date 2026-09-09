import { NextFunction, Request, Response } from 'express';
import { OpenSourceProject } from '../models/OpenSourceProjectModel';
import { User } from '../models/UserModel';
import { createNotification } from '../services/notificationService';
import { sendTelegramMessage, notifyAdminNewOpenSourceSubmission } from '../services/telegramService';

const INITIAL_PROJECTS = [
    {
        title: 'dever-cli',
        description: 'Công cụ CLI giúp setup dự án nhanh cho thành viên CLB.',
        author: 'Nhật Quang',
        stars: 12,
        githubUrl: 'https://github.com/fu-dever/dever-cli',
        category: 'CLI Tool',
        tags: ['CLI', 'TypeScript', 'Node.js'],
        isPublished: true,
    },
    {
        title: 'fptu-timetable',
        description: 'Extension Chrome hỗ trợ xếp lịch học cho sinh viên FPTU.',
        author: 'Vũ Vũ',
        stars: 45,
        githubUrl: 'https://github.com/fu-dever/fptu-timetable',
        category: 'Browser Extension',
        tags: ['Extension', 'React', 'Chrome'],
        isPublished: true,
    },
    {
        title: 'algorithm-visualizer',
        description: 'Website mô phỏng các thuật toán kinh điển trực quan.',
        author: 'Hải Trần',
        stars: 30,
        githubUrl: 'https://github.com/fu-dever/algorithm-visualizer',
        category: 'Web App',
        tags: ['Algorithm', 'Next.js', 'Canvas'],
        isPublished: true,
    },
];

export const listOpenSourceProjects = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filter: any = { isPublished: true };
        if (req.query.authorId) {
            filter.authorId = req.query.authorId;
        }
        const projects = await OpenSourceProject.find(filter).sort({ stars: -1, createdAt: -1 });
        return res.status(200).json({ status: 'success', results: projects.length, data: projects });
    } catch (error) {
        return next(error);
    }
};

export const listAllOpenSourceProjectsForAdmin = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await OpenSourceProject.find().sort({ createdAt: -1 });
        return res.status(200).json({ status: 'success', results: projects.length, data: projects });
    } catch (error) {
        return next(error);
    }
};

export const createOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, description, author, stars, githubUrl, demoUrl, category, tags, isPublished } = req.body;
        const project = await OpenSourceProject.create({
            title,
            description,
            author: author || 'Thành viên DEVER',
            stars: Number(stars) || 0,
            githubUrl: githubUrl || 'https://github.com/fu-dever',
            demoUrl: demoUrl || '',
            category: category || 'Open Source',
            tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [],
            isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        });

        return res.status(201).json({ status: 'success', data: project });
    } catch (error) {
        return next(error);
    }
};

/**
 * Member submits an Open-Source project for community showcase
 */
export const submitOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const user = userId ? await User.findById(userId) : null;
        const authorName = user ? [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname || 'Thành viên DEVER' : req.body.author || 'Thành viên DEVER';

        const { title, description, githubUrl, demoUrl, category, tags } = req.body;
        if (!title || !description || !githubUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp Tên dự án, Mô tả và Đường dẫn GitHub Repository',
            });
        }

        const project = await OpenSourceProject.create({
            title: title.trim(),
            description: description.trim(),
            author: authorName,
            authorId: userId || null,
            stars: 0,
            githubUrl: githubUrl.trim(),
            demoUrl: (demoUrl || '').trim(),
            category: category || 'Open Source',
            tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            isPublished: false, // requires admin approval
        });

        // Notify Admin via In-App & Telegram
        createNotification({
            recipientRole: 'admin',
            type: 'system_alert',
            title: 'Dự án Open Source mới gửi duyệt 💻',
            message: `Thành viên ${authorName} vừa gửi dự án "${title}" lên hàng đợi duyệt.`,
            link: '/vi/community-content?tab=opensource&filter=pending',
            meta: { project },
            sendTelegram: false,
        }).catch(() => {});

        notifyAdminNewOpenSourceSubmission(project, authorName).catch(() => {});

        return res.status(201).json({
            status: 'success',
            message: 'Đã gửi dự án thành công! Ban Quản Trị sẽ xem xét và xuất bản sớm nhất.',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};

export const updateOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, description, author, stars, githubUrl, demoUrl, category, tags, isPublished } = req.body;
        const oldProject = await OpenSourceProject.findById(req.params.id);
        if (!oldProject) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy dự án' });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (author !== undefined) updateData.author = author;
        if (stars !== undefined) updateData.stars = Number(stars);
        if (githubUrl !== undefined) updateData.githubUrl = githubUrl;
        if (demoUrl !== undefined) updateData.demoUrl = demoUrl;
        if (category !== undefined) updateData.category = category;
        if (tags !== undefined) {
            updateData.tags = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [];
        }
        if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);

        const project = await OpenSourceProject.findByIdAndUpdate(req.params.id, updateData, { new: true });

        // If newly published and has authorId, award +150 EXP and unlock core_contributor badge
        if (isPublished === true && oldProject.isPublished === false && oldProject.authorId) {
            const userAuthor = await User.findById(oldProject.authorId);
            if (userAuthor) {
                userAuthor.exp = (userAuthor.exp || 0) + 150;
                userAuthor.unlockedBadges = userAuthor.unlockedBadges || [];
                const alreadyHasBadge = userAuthor.unlockedBadges.some((b: any) => b.badgeId === 'core_contributor');
                if (!alreadyHasBadge) {
                    userAuthor.unlockedBadges.push({ badgeId: 'core_contributor', unlockedAt: new Date() });
                }
                await userAuthor.save();

                createNotification({
                    recipientId: oldProject.authorId.toString(),
                    type: 'badge_unlocked',
                    title: 'Dự án của bạn đã được xuất bản! 🌟',
                    message: `Dự án "${oldProject.title}" đã được duyệt (+150 EXP và mở khóa Huy hiệu Core Contributor).`,
                    link: '/discover',
                    meta: { project, milestone: { badgeTitle: 'Core Contributor' }, user: userAuthor },
                    sendTelegram: true,
                }).catch(() => {});
            }
        }

        return res.status(200).json({ status: 'success', data: project });
    } catch (error) {
        return next(error);
    }
};

export const deleteOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await OpenSourceProject.findByIdAndDelete(req.params.id);
        return res.status(200).json({ status: 'success', message: 'Dự án đã được xóa thành công' });
    } catch (error) {
        return next(error);
    }
};

/**
 * Member retrieves their own submitted Open-Source projects (including pending approval)
 */
export const getMySubmittedProjects = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Vui lòng đăng nhập để xem dự án cá nhân' });
        }
        const projects = await OpenSourceProject.find({ authorId: userId }).sort({ createdAt: -1 });
        return res.status(200).json({ status: 'success', results: projects.length, data: projects });
    } catch (error) {
        return next(error);
    }
};

/**
 * Admin 1-click approve and publish an Open-Source project (+150 EXP and Core Contributor badge)
 */
export const approveOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await OpenSourceProject.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy dự án' });
        }

        const wasPublished = project.isPublished;
        project.isPublished = true;
        await project.save();

        if (!wasPublished && project.authorId) {
            const author = await User.findById(project.authorId);
            if (author) {
                author.exp = (author.exp || 0) + 150;
                author.unlockedBadges = author.unlockedBadges || [];
                const alreadyHasBadge = author.unlockedBadges.some((b: any) => b.badgeId === 'core_contributor');
                if (!alreadyHasBadge) {
                    author.unlockedBadges.push({ badgeId: 'core_contributor', unlockedAt: new Date() });
                }
                await author.save();

                createNotification({
                    recipientId: project.authorId.toString(),
                    type: 'badge_unlocked',
                    title: 'Dự án của bạn đã được xuất bản! 🌟',
                    message: `Dự án "${project.title}" đã được duyệt (+150 EXP và mở khóa Huy hiệu Core Contributor).`,
                    link: '/discover',
                    meta: { project, milestone: { badgeTitle: 'Core Contributor' }, user: author },
                    sendTelegram: true,
                }).catch(() => {});
            }
        }

        return res.status(200).json({
            status: 'success',
            message: 'Đã duyệt và xuất bản dự án thành công!',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * Admin reject or unpublish an Open-Source project
 */
export const rejectOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await OpenSourceProject.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy dự án' });
        }

        project.isPublished = false;
        await project.save();

        return res.status(200).json({
            status: 'success',
            message: 'Đã ẩn dự án khỏi trang công khai.',
            data: project,
        });
    } catch (error) {
        return next(error);
    }
};
