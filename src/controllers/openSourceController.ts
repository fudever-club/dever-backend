import { NextFunction, Request, Response } from 'express';
import { OpenSourceProject } from '../models/OpenSourceProjectModel';

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

export const updateOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, description, author, stars, githubUrl, demoUrl, category, tags, isPublished } = req.body;
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

        const project = await OpenSourceProject.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!project) return res.status(404).json({ status: 'error', message: 'Project not found' });
        return res.status(200).json({ status: 'success', data: project });
    } catch (error) {
        return next(error);
    }
};

export const deleteOpenSourceProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await OpenSourceProject.findByIdAndDelete(req.params.id);
        if (!project) return res.status(404).json({ status: 'error', message: 'Project not found' });
        return res.status(200).json({ status: 'success', message: 'Project deleted successfully' });
    } catch (error) {
        return next(error);
    }
};
