import { NextFunction, Request, Response } from 'express';
import { FundCampaign } from '../models/FundCampaignModel';
import { FundPayment } from '../models/FundPaymentModel';
import { User } from '../models/UserModel';
import { sendTelegramMessage } from '../services/telegramService';

/**
 * 1. Get currently active fund campaign for member client
 */
export const getActiveCampaign = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        let campaign = await FundCampaign.findOne({ status: 'active' }).sort({ createdAt: -1 });

        // If no active campaign exists, create a default one for the current semester
        if (!campaign) {
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 30);

            campaign = await FundCampaign.create({
                title: 'Quỹ Hoạt Động & Phát Triển CLB FU-DEVER Kỳ Fall 2026',
                description: 'Phục vụ hoạt động sinh hoạt định kỳ, teambuilding, mua sắm thiết bị phần cứng Project Lab và tài trợ giải thưởng giải thuật LeetCode.',
                amount: 100000,
                startDate: new Date(),
                deadline: nextMonth,
                semester: 'Fall 2026',
                status: 'active',
                bankInfo: {
                    bankName: 'MBBank (Ngân hàng Quân Đội)',
                    bankCode: 'MB',
                    accountNumber: '0912345678',
                    accountHolder: 'CLB LAP TRINH FU DEVER',
                    transferSyntaxTemplate: 'DEVER [MSSV] [HoTen]',
                    qrTemplateUrl: 'https://img.vietqr.io/image/MB-0912345678-compact2.png',
                },
                targetTotalAmount: 5000000,
            });
        }

        return res.status(200).json({
            status: 'success',
            data: campaign,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 2. Get member's payment history and current status
 */
export const getMyFundPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const payments = await FundPayment.find({ userId })
            .populate('campaignId', 'title amount deadline semester status bankInfo')
            .sort({ createdAt: -1 });

        const activeCampaign = await FundCampaign.findOne({ status: 'active' }).sort({ createdAt: -1 });
        let activePayment = null;
        if (activeCampaign) {
            activePayment = await FundPayment.findOne({
                campaignId: activeCampaign._id,
                userId,
            }).sort({ createdAt: -1 });
        }

        return res.status(200).json({
            status: 'success',
            data: {
                activeCampaign,
                activePayment,
                history: payments,
            },
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 3. Member submits proof of payment (VietQR Transfer Proof)
 */
export const submitFundPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const { campaignId, proofImageUrl, transactionCode, note, amount } = req.body;

        if (!campaignId || !proofImageUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp đầy đủ mã chiến dịch và hình ảnh minh chứng chuyển khoản',
            });
        }

        const campaign = await FundCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ status: 'error', message: 'Kỳ thu quỹ không tồn tại' });
        }

        const user = await User.findById(userId);
        const userName = user ? [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname || 'Thành viên DEVER' : 'Thành viên';
        const userMSSV = user?.MSSV || 'N/A';

        // Check if there is already an existing payment for this campaign
        let payment = await FundPayment.findOne({ campaignId, userId });
        if (payment) {
            payment.proofImageUrl = proofImageUrl;
            payment.transactionCode = transactionCode || payment.transactionCode;
            payment.note = note || payment.note;
            payment.amount = amount || campaign.amount;
            payment.status = 'pending';
            payment.reviewNotes = '';
            await payment.save();
        } else {
            payment = await FundPayment.create({
                campaignId,
                userId,
                amount: amount || campaign.amount,
                proofImageUrl,
                transactionCode: transactionCode || '',
                note: note || '',
                status: 'pending',
            });
        }

        // Send Telegram notification to Admin
        const formattedAmount = (amount || campaign.amount).toLocaleString('vi-VN') + ' đ';
        const adminUrl = process.env.ADMIN_URL || 'https://admin.fudever.com';
        const telegramMsg = `
💰 <b>[FU-DEVER QUỸ CLB] CÓ THÀNH VIÊN NỘP MINH CHỨNG ĐÓNG QUỸ!</b>

👤 <b>Thành viên:</b> ${userName} (MSSV: ${userMSSV})
📌 <b>Kỳ thu quỹ:</b> ${campaign.title}
💵 <b>Số tiền:</b> <b>${formattedAmount}</b>
🏷️ <b>Mã giao dịch:</b> ${transactionCode || 'Chưa cung cấp'}
💬 <b>Ghi chú:</b> ${note || 'Không có'}
📅 <b>Nộp lúc:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

👉 <a href="${adminUrl}/vi/fund-management"><b>XEM VÀ DUYỆT MINH CHỨNG TRÊN ADMIN DASHBOARD</b></a>
`.trim();
        sendTelegramMessage(undefined, telegramMsg).catch(() => {});

        return res.status(201).json({
            status: 'success',
            message: 'Đã gửi minh chứng đóng quỹ thành công! Ban Quản Trị sẽ đối soát và xác nhận sớm nhất.',
            data: payment,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 4. Admin: Get all fund campaigns
 */
export const getAdminCampaigns = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const campaigns = await FundCampaign.find({}).sort({ createdAt: -1 });

        // Attach statistics to each campaign
        const campaignsWithStats = await Promise.all(
            campaigns.map(async (c) => {
                const totalPayments = await FundPayment.countDocuments({ campaignId: c._id });
                const approvedPayments = await FundPayment.countDocuments({ campaignId: c._id, status: 'approved' });
                const pendingPayments = await FundPayment.countDocuments({ campaignId: c._id, status: 'pending' });
                const totalCollected = approvedPayments * c.amount;

                return {
                    ...c.toObject(),
                    stats: {
                        totalPayments,
                        approvedPayments,
                        pendingPayments,
                        totalCollected,
                    },
                };
            }),
        );

        return res.status(200).json({
            status: 'success',
            data: campaignsWithStats,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 5. Admin: Create a new campaign
 */
export const createAdminCampaign = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        const { title, description, amount, startDate, deadline, semester, bankInfo, targetTotalAmount } = req.body;

        if (!title || !deadline || !amount) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp tiêu đề, số tiền và hạn chót' });
        }

        const campaign = await FundCampaign.create({
            title,
            description,
            amount: Number(amount),
            startDate: startDate ? new Date(startDate) : new Date(),
            deadline: new Date(deadline),
            semester: semester || 'Fall 2026',
            status: 'active',
            bankInfo: bankInfo || {
                bankName: 'MBBank (Ngân hàng Quân Đội)',
                bankCode: 'MB',
                accountNumber: '0912345678',
                accountHolder: 'CLB LAP TRINH FU DEVER',
                transferSyntaxTemplate: 'DEVER [MSSV] [HoTen]',
                qrTemplateUrl: 'https://img.vietqr.io/image/MB-0912345678-compact2.png',
            },
            targetTotalAmount: Number(targetTotalAmount) || 5000000,
            createdBy: userId || null,
        });

        return res.status(201).json({
            status: 'success',
            message: 'Tạo kỳ thu quỹ mới thành công!',
            data: campaign,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 6. Admin: Update a campaign (deadline, status, bank info)
 */
export const updateAdminCampaign = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const updated = await FundCampaign.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy kỳ thu quỹ' });
        }
        return res.status(200).json({
            status: 'success',
            message: 'Cập nhật kỳ thu quỹ thành công!',
            data: updated,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 7. Admin: Get all payments for review
 */
export const getAdminPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { campaignId, status, search } = req.query;
        const filter: Record<string, unknown> = {};

        if (campaignId) filter.campaignId = campaignId;
        if (status && status !== 'all') filter.status = status;

        const payments = await FundPayment.find(filter)
            .populate('campaignId', 'title amount deadline semester')
            .populate('userId', 'firstname lastname nickname email MSSV avatar')
            .populate('reviewedBy', 'firstname lastname email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: 'success',
            results: payments.length,
            data: payments,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 8. Admin: Review payment proof (Approve / Reject)
 */
export const reviewAdminPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = res.locals.auth?.userId;
        const { id } = req.params;
        const { status, reviewNotes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Trạng thái duyệt không hợp lệ' });
        }

        const payment = await FundPayment.findById(id)
            .populate('campaignId', 'title amount')
            .populate('userId', 'firstname lastname email');

        if (!payment) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy bản ghi đóng quỹ' });
        }

        payment.status = status;
        payment.reviewNotes = reviewNotes || '';
        payment.reviewedBy = adminId || null;
        payment.reviewedAt = new Date();
        await payment.save();

        return res.status(200).json({
            status: 'success',
            message: status === 'approved' ? 'Đã duyệt minh chứng đóng quỹ thành công!' : 'Đã từ chối minh chứng đóng quỹ.',
            data: payment,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * 9. Admin: Financial analytics
 */
export const getFundAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const activeCampaign = await FundCampaign.findOne({ status: 'active' }).sort({ createdAt: -1 });
        const totalMembers = await User.countDocuments({});

        let totalApproved = 0;
        let totalPending = 0;
        let totalRejected = 0;
        let totalMoneyCollected = 0;

        if (activeCampaign) {
            totalApproved = await FundPayment.countDocuments({ campaignId: activeCampaign._id, status: 'approved' });
            totalPending = await FundPayment.countDocuments({ campaignId: activeCampaign._id, status: 'pending' });
            totalRejected = await FundPayment.countDocuments({ campaignId: activeCampaign._id, status: 'rejected' });
            totalMoneyCollected = totalApproved * activeCampaign.amount;
        }

        const completionPercent = totalMembers > 0 ? Math.min(100, Math.round((totalApproved / totalMembers) * 100)) : 0;

        return res.status(200).json({
            status: 'success',
            data: {
                activeCampaign,
                totalMembers,
                totalApproved,
                totalPending,
                totalRejected,
                totalMoneyCollected,
                completionPercent,
            },
        });
    } catch (error) {
        return next(error);
    }
};
