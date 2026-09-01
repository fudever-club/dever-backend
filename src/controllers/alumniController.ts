import { NextFunction, Request, Response } from 'express';
import { Alumni } from '../models/AlumniModel';
import { User } from '../models/UserModel';
import { sendTelegramMessage } from '../services/telegramService';

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
    'isAdvisoryBoard',
    'mentoringTopics',
    'advisoryAcceptedAt',
    'isPublished',
] as const;

const input = (body: Record<string, unknown>) =>
    editableFields.reduce((value, field) => {
        if (body[field] !== undefined) value[field] = body[field];
        return value;
    }, {} as Record<(typeof editableFields)[number], unknown>);

export const listAlumni = async (_req: Request, res: Response, next: NextFunction) => {
    try {
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

/**
 * Check if the current member has an Advisory Board profile or invitation status
 */
export const getAdvisoryInvitationStatus = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
        }

        const existingAlumni = await Alumni.findOne({ userId });

        return res.status(200).json({
            status: 'success',
            data: {
                isJoined: Boolean(existingAlumni),
                alumni: existingAlumni,
                user: {
                    name: [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname,
                    avatar: user.avatar,
                    email: user.email,
                },
            },
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * Cựu sinh viên xác nhận thư mời, điền thông tin và tham gia Ban Cố Vấn & Bảng Vàng
 */
export const acceptAdvisoryInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
        }

        const { graduationGen, headline, workplace, quote, mentoringTopics, profileUrl } = req.body;

        const userName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname || 'Cựu thành viên DEVER';

        let alumnus = await Alumni.findOne({ userId });
        if (alumnus) {
            alumnus.name = userName;
            alumnus.graduationGen = graduationGen || alumnus.graduationGen;
            alumnus.headline = headline || alumnus.headline;
            alumnus.workplace = workplace || alumnus.workplace;
            alumnus.quote = quote || alumnus.quote;
            alumnus.mentoringTopics = Array.isArray(mentoringTopics) ? mentoringTopics : alumnus.mentoringTopics;
            alumnus.profileUrl = profileUrl || alumnus.profileUrl;
            alumnus.avatar = user.avatar || alumnus.avatar;
            alumnus.isMentor = true;
            alumnus.isAdvisoryBoard = true;
            alumnus.isPublished = true;
            alumnus.advisoryAcceptedAt = new Date();
            await alumnus.save();
        } else {
            alumnus = await Alumni.create({
                userId,
                name: userName,
                graduationGen: graduationGen || 'Gen 5',
                headline: headline || 'Software Engineer & DEVER Mentor',
                workplace: workplace || 'Tech Enterprise',
                quote: quote || 'Tự hào đồng hành cùng các thế hệ đàn em FU-DEVER!',
                mentoringTopics: Array.isArray(mentoringTopics) ? mentoringTopics : ['Định hướng nghề nghiệp', 'Kỹ thuật & Giải thuật'],
                profileUrl: profileUrl || 'https://linkedin.com',
                avatar: user.avatar || '/images/avatar/avatar.jpg',
                isMentor: true,
                isAdvisoryBoard: true,
                isPublished: true,
                advisoryAcceptedAt: new Date(),
            });
        }

        // Send Telegram alert
        const landingUrl = process.env.LANDING_URL || 'https://fudever.com';
        const topicsStr = alumnus.mentoringTopics?.join(', ') || 'Chuyên môn phần mềm';
        const telegramMsg = `
🌟 <b>[FU-DEVER BAN CỐ VẤN] CỰU THÀNH VIÊN ĐÃ ĐỒNG Ý THAM GIA HỘI ĐỒNG CỐ VẤN!</b>

👤 <b>Cố vấn:</b> ${userName} (${alumnus.graduationGen})
🏢 <b>Nơi công tác:</b> ${alumnus.workplace}
💼 <b>Chức danh:</b> ${alumnus.headline}
🎯 <b>Lĩnh vực cố vấn:</b> ${topicsStr}
💬 <b>Châm ngôn:</b> <i>"${alumnus.quote}"</i>

👉 <a href="${landingUrl}/alumni"><b>XEM HỒ SƠ CỐ VẤN TRÊN TRANG ALUMNI</b></a>
`.trim();
        sendTelegramMessage(undefined, telegramMsg).catch(() => {});

        return res.status(200).json({
            status: 'success',
            message: 'Chúc mừng Anh/Chị đã gia nhập Ban Cố Vấn FU-DEVER! Hồ sơ của Anh/Chị đã được xuất bản trên trang Alumni.',
            data: alumnus,
        });
    } catch (error) {
        return next(error);
    }
};
