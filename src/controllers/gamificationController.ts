import { NextFunction, Request, Response } from 'express';
import { User } from '../models/UserModel';

export interface BadgeDefinition {
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    bgColor: string;
    requirement: string;
}

export const BADGES: BadgeDefinition[] = [
    {
        id: 'algorithmic_prodigy',
        title: 'Algorithmic Prodigy',
        description: 'Vinh danh thành viên đạt thành tích xuất sắc trên Bảng xếp hạng LeetCode CLB.',
        icon: 'trophy',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        requirement: 'Liên kết tài khoản LeetCode & giải thuật toán',
    },
    {
        id: 'pro_tech_author',
        title: 'Pro Tech Author',
        description: 'Tác giả kỹ thuật tiêu biểu chia sẻ kiến thức chuyên môn cho cộng đồng DEVER.',
        icon: 'pen-tool',
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
        requirement: 'Soạn thảo và xuất bản bài viết công nghệ',
    },
    {
        id: 'speed_coder',
        title: 'Speed Coder',
        description: 'Chiến binh chăm chỉ duy trì chuỗi hoạt động điểm danh liên tục 7 ngày.',
        icon: 'zap',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        requirement: 'Duy trì chuỗi hoạt động liên tục từ 7 ngày',
    },
    {
        id: 'core_contributor',
        title: 'Core Contributor',
        description: 'Đóng góp dự án mã nguồn mở và sáng kiến kỹ thuật trong hệ sinh thái FU-DEVER.',
        icon: 'code-2',
        color: '#0066CC',
        bgColor: '#EFF6FF',
        requirement: 'Đóng góp dự án Open Source hoặc Project Lab',
    },
    {
        id: 'security_sentinel',
        title: 'Security Sentinel',
        description: 'Thành viên gương mẫu hoàn thiện 100% hồ sơ bảo mật và thông tin cá nhân.',
        icon: 'shield-check',
        color: '#10B981',
        bgColor: '#D1FAE5',
        requirement: 'Hoàn thiện đầy đủ thông tin hồ sơ thành viên',
    },
];

export const calculateGamificationProfile = (exp: number = 0, streakDays: number = 1, unlockedBadges: any[] = []) => {
    const safeExp = Math.max(0, exp);
    const level = Math.floor(Math.sqrt(safeExp / 100)) + 1;
    const baseExpForCurrentLevel = Math.pow(level - 1, 2) * 100;
    const targetExpForNextLevel = Math.pow(level, 2) * 100;
    const currentLevelExp = safeExp - baseExpForCurrentLevel;
    const expNeededForNextLevel = targetExpForNextLevel - baseExpForCurrentLevel;
    const progressPercent = Math.min(100, Math.round((currentLevelExp / expNeededForNextLevel) * 100));

    let title = 'Junior Explorer';
    if (level >= 10) title = 'DEVER Grandmaster';
    else if (level >= 7) title = 'System Architect';
    else if (level >= 5) title = 'Algorithm Master';
    else if (level >= 3) title = 'Code Pathfinder';

    // Map all badges with unlocked status
    const unlockedMap = new Map(unlockedBadges.map((b: any) => [b.badgeId, b.unlockedAt]));
    const badges = BADGES.map((badge) => ({
        ...badge,
        isUnlocked: unlockedMap.has(badge.id),
        unlockedAt: unlockedMap.get(badge.id) || null,
    }));

    return {
        exp: safeExp,
        level,
        title,
        streakDays,
        currentLevelExp,
        expNeededForNextLevel,
        targetExpForNextLevel,
        progressPercent,
        badges,
        unlockedCount: unlockedBadges.length,
        totalBadgesCount: BADGES.length,
    };
};

export const getMyGamificationStats = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const user = await User.findById(userId).select('exp streakDays lastCheckinDate unlockedBadges firstname lastname email avatar description skills leetcodeUsername');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
        }

        let userExp = user.exp || 150;
        let streakDays = user.streakDays || 1;
        let unlockedBadges: any[] = user.unlockedBadges || [];
        let modified = false;

        // Auto-award badges based on member achievements
        const hasBadge = (id: string) => unlockedBadges.some((b) => b.badgeId === id);

        // 1. Security Sentinel: If profile has avatar, description, skills
        if (!hasBadge('security_sentinel') && user.avatar && user.description && user.skills?.length > 0) {
            unlockedBadges.push({ badgeId: 'security_sentinel', unlockedAt: new Date() });
            userExp += 50;
            modified = true;
        }

        // 2. Algorithmic Prodigy: If user has linked LeetCode username
        if (!hasBadge('algorithmic_prodigy') && (user as any).leetcodeUsername) {
            unlockedBadges.push({ badgeId: 'algorithmic_prodigy', unlockedAt: new Date() });
            userExp += 50;
            modified = true;
        }

        // 3. Speed Coder: If streak >= 7
        if (!hasBadge('speed_coder') && streakDays >= 7) {
            unlockedBadges.push({ badgeId: 'speed_coder', unlockedAt: new Date() });
            userExp += 100;
            modified = true;
        }

        // 4. Core Contributor: Given by default for active developers
        if (!hasBadge('core_contributor')) {
            unlockedBadges.push({ badgeId: 'core_contributor', unlockedAt: new Date() });
            modified = true;
        }

        if (modified) {
            user.exp = userExp;
            user.unlockedBadges = unlockedBadges;
            await user.save();
        }

        // Check if checked in today
        const now = new Date();
        const lastCheckin = user.lastCheckinDate ? new Date(user.lastCheckinDate) : null;
        const isCheckedInToday =
            lastCheckin !== null &&
            lastCheckin.getFullYear() === now.getFullYear() &&
            lastCheckin.getMonth() === now.getMonth() &&
            lastCheckin.getDate() === now.getDate();

        const stats = calculateGamificationProfile(userExp, streakDays, unlockedBadges);

        return res.status(200).json({
            status: 'success',
            data: {
                ...stats,
                isCheckedInToday,
                lastCheckinDate: user.lastCheckinDate,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const dailyCheckin = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
        }

        const now = new Date();
        const lastCheckin = user.lastCheckinDate ? new Date(user.lastCheckinDate) : null;

        if (lastCheckin) {
            const isSameDay =
                lastCheckin.getFullYear() === now.getFullYear() &&
                lastCheckin.getMonth() === now.getMonth() &&
                lastCheckin.getDate() === now.getDate();

            if (isSameDay) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Bạn đã hoàn thành điểm danh hôm nay rồi! Hãy quay lại vào ngày mai nhé.',
                });
            }

            // Check if consecutive day
            const oneDayMs = 24 * 60 * 60 * 1000;
            const diffDays = Math.floor((now.getTime() - lastCheckin.getTime()) / oneDayMs);

            if (diffDays <= 1.5) {
                user.streakDays = (user.streakDays || 1) + 1;
            } else {
                user.streakDays = 1; // reset streak if missed a day
            }
        } else {
            user.streakDays = 1;
        }

        // Award EXP (+25 base, +10 bonus for streak >= 3)
        const bonusExp = (user.streakDays || 1) >= 3 ? 35 : 25;
        user.exp = (user.exp || 0) + bonusExp;
        user.lastCheckinDate = now;

        // Speed coder badge check
        let unlockedBadges = user.unlockedBadges || [];
        if (user.streakDays >= 7 && !unlockedBadges.some((b: any) => b.badgeId === 'speed_coder')) {
            unlockedBadges.push({ badgeId: 'speed_coder', unlockedAt: now });
            user.exp += 100;
            user.unlockedBadges = unlockedBadges;
        }

        await user.save();

        const stats = calculateGamificationProfile(user.exp, user.streakDays, user.unlockedBadges);

        return res.status(200).json({
            status: 'success',
            message: `Điểm danh thành công! Bạn nhận được +${bonusExp} EXP`,
            data: {
                ...stats,
                isCheckedInToday: true,
                earnedExp: bonusExp,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const getHallOfFame = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await User.find({ isExcellent: { $ne: null } })
            .select('firstname lastname avatar exp streakDays unlockedBadges positionId departments')
            .populate('positionId', 'name')
            .populate('departments', 'name')
            .sort({ exp: -1 })
            .limit(10);

        const leaderUsers = users.map((u: any, index: number) => {
            const exp = u.exp || 150 + (10 - index) * 50;
            const level = Math.floor(Math.sqrt(exp / 100)) + 1;
            return {
                _id: u._id,
                name: [u.firstname, u.lastname].filter(Boolean).join(' ') || 'Thành viên DEVER',
                avatar: u.avatar,
                exp,
                level,
                streakDays: u.streakDays || Math.max(1, 10 - index),
                badgeCount: u.unlockedBadges?.length || 2,
                position: (u.positionId as any)?.name || 'Member',
            };
        });

        return res.status(200).json({
            status: 'success',
            results: leaderUsers.length,
            data: leaderUsers,
        });
    } catch (error) {
        return next(error);
    }
};
