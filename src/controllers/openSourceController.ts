import { NextFunction, Request, Response } from 'express';
import { OpenSourceProject } from '../models/OpenSourceProjectModel';
import { User } from '../models/UserModel';
import { createNotification } from '../services/notificationService';
import { sendTelegramMessage } from '../services/telegramService';

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

export const listOpenSourceProjects = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        let count = await OpenSourceProject.countDocuments();
        if (count === 0) {
            await OpenSourceProject.insertMany(INITIAL_PROJECTS);
        }

        const projects = await OpenSourceProject.find({ isPublished: true }).sort({ stars: -1, createdAt: -1 });
        return res.status(200).json({ status: 'success', results: projects.length, data: projects });
    } catch (error) {
        return next(error);
    }
};

export const listAllOpenSourceProjectsForAdmin = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        let count = await OpenSourceProject.countDocuments();
        if (count === 0) {
            await OpenSourceProject.insertMany(INITIAL_PROJECTS);
        }

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
            link: '/vi/content-management',
            meta: { project },
            sendTelegram: true,
        }).catch(() => {});

        const telegramMsg = `
💻 <b>[FU-DEVER PROJECT LAB] CÓ DỰ ÁN MỚI GỬI DUYỆT!</b>

📌 <b>Tên dự án:</b> ${title}
👤 <b>Tác giả:</b> ${authorName}
📂 <b>GitHub:</b> ${githubUrl}
🏷️ <b>Chuyên mục:</b> ${category || 'Open Source'}

👉 <a href="${process.env.ADMIN_URL || 'https://admin.fudever.com'}/vi/content-management"><b>XEM VÀ DUYỆT DỰ ÁN TRÊN ADMIN DASHBOARD</b></a>
`.trim();
        sendTelegramMessage(undefined, telegramMsg).catch(() => {});

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
            await User.findByIdAndUpdate(oldProject.authorId, {
                $inc: { exp: 150 },
                $addToSet: { unlockedBadges: { badgeId: 'core_contributor', unlockedAt: new Date() } },
            });

            createNotification({
                recipientId: oldProject.authorId.toString(),
                type: 'badge_unlocked',
                title: 'Dự án của bạn đã được xuất bản! 🌟',
                message: `Dự án "${oldProject.title}" đã được duyệt (+150 EXP và mở khóa Huy hiệu Core Contributor).`,
                link: '/discover',
                meta: { project, milestone: { badgeTitle: 'Core Contributor' } },
                sendTelegram: true,
            }).catch(() => {});
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
