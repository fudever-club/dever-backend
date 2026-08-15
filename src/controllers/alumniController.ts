import { NextFunction, Request, Response } from 'express';
import { Alumni } from '../models/AlumniModel';

const editableFields = [
    'userId',
    'name',
    'graduationGen',
    'headline',
    'bio',
    'quote',
    'workplace',
    'companyLogo',
    'avatar',
    'profileUrl',
    'isMentor',
    'isPublished',
] as const;

const SEED_ALUMNI = [
    {
        name: 'Trần Minh Quang',
        graduationGen: 'Gen 1',
        headline: 'Tech Lead & Software Architect',
        workplace: 'Axon Active',
        quote: 'DEVER là nơi mình học cách tư duy kiến trúc hệ thống và giải quyết bài toán phức tạp trước khi bước ra môi trường quốc tế.',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
    {
        name: 'Nguyễn Hải Đăng',
        graduationGen: 'Gen 2',
        headline: 'Senior Backend Engineer',
        workplace: 'FPT Software',
        quote: 'Luyện tập giải thuật và làm dự án thực chiến tại DEVER là bệ phóng giúp mình vượt qua mọi vòng phỏng vấn OJT.',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
    {
        name: 'Lê Thị Thu Thảo',
        graduationGen: 'Gen 3',
        headline: 'Product Designer & Frontend Specialist',
        workplace: 'VNG Corp',
        quote: 'Portfolio làm cùng đội ngũ DEVER từ năm 2 đã giúp mình nhận offer chính thức ngay trong kỳ thực tập.',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
    {
        name: 'Phạm Đức Huy',
        graduationGen: 'Gen 4',
        headline: 'Fullstack Cloud Engineer',
        workplace: 'KMS Technology',
        quote: 'Môi trường chia sẻ tri thức tại DEVER tạo nên tinh thần kỷ luật và sự kiên trì theo đuổi nghề lập trình.',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
    {
        name: 'Võ Hoàng Nam',
        graduationGen: 'Gen 5',
        headline: 'AI & Data Intelligence Engineer',
        workplace: 'SmartDev',
        quote: 'Chủ động xây dựng sản phẩm từ sớm tại Project Lab của CLB là lợi thế cạnh tranh lớn nhất khi xin việc.',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
    {
        name: 'Đặng Quốc Bảo',
        graduationGen: 'Gen 6',
        headline: 'Software Engineer',
        workplace: 'FPT Software',
        quote: 'Học hỏi từ các anh chị Mentor đi trước đã giúp mình định hình lộ trình sự nghiệp vững chắc.',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        profileUrl: 'https://linkedin.com',
        isMentor: true,
        isPublished: true,
    },
];

const input = (body: Record<string, unknown>) =>
    editableFields.reduce((value, field) => {
        if (body[field] !== undefined) value[field] = body[field];
        return value;
    }, {} as Record<(typeof editableFields)[number], unknown>);

export const listAlumni = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        // Auto convert old K-style tags if any
        await Alumni.updateMany({ graduationGen: 'K15' }, { graduationGen: 'Gen 1' });
        await Alumni.updateMany({ graduationGen: 'K16' }, { graduationGen: 'Gen 2' });
        await Alumni.updateMany({ graduationGen: 'K17' }, { graduationGen: 'Gen 3' });
        await Alumni.updateMany({ graduationGen: 'K18' }, { graduationGen: 'Gen 4' });
        await Alumni.updateOne({ name: 'Võ Hoàng Nam' }, { graduationGen: 'Gen 5' });
        await Alumni.updateOne({ name: 'Đặng Quốc Bảo' }, { graduationGen: 'Gen 6' });

        for (const item of SEED_ALUMNI) {
            const exists = await Alumni.findOne({ name: item.name });
            if (!exists) {
                await Alumni.create(item);
            } else if (exists.graduationGen !== item.graduationGen) {
                exists.graduationGen = item.graduationGen;
                await exists.save();
            }
        }
        const filter = res.locals.auth?.isAdmin ? {} : { isPublished: true };
        const alumni = await Alumni.find(filter).sort({ graduationGen: 1, createdAt: -1 });
        return res.status(200).json({ status: 'success', data: alumni });
    } catch (error) {
        return next(error);
    }
};

export const createAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.create(input(req.body || {}));
        return res.status(201).json({ status: 'success', data: alumnus });
    } catch (error) {
        return next(error);
    }
};

export const updateAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.findByIdAndUpdate(req.params.id, input(req.body || {}), {
            new: true,
            runValidators: true,
        });
        if (!alumnus) return res.status(404).json({ status: 'error', message: 'Alumni item not found' });
        return res.status(200).json({ status: 'success', data: alumnus });
    } catch (error) {
        return next(error);
    }
};

export const deleteAlumni = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alumnus = await Alumni.findByIdAndDelete(req.params.id);
        if (!alumnus) return res.status(404).json({ status: 'error', message: 'Alumni item not found' });
        return res.status(200).json({ status: 'success', message: 'Alumni item deleted' });
    } catch (error) {
        return next(error);
    }
};
