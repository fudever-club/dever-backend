import { NextFunction, Request, Response } from 'express';
import { FundCampaign } from '../models/FundCampaignModel';
import { FundPayment } from '../models/FundPaymentModel';
import { FundAuditLog } from '../models/FundAuditLogModel';
import { User } from '../models/UserModel';
import { sendTelegramMessage } from '../services/telegramService';

/** Best-effort audit write: a logging failure must never fail the payment flow. */
const recordFundAudit = (
    entry: {
        paymentId: unknown;
        campaignId: unknown;
        payerId: unknown;
        action: 'submitted' | 'approved' | 'rejected';
        actorId: unknown;
        amount: number;
        note?: string;
    },
): void => {
    FundAuditLog.create(entry as any).catch((err) => {
        console.error('[FundAudit] write failed:', err?.message || err);
    });
};

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
                    bankName: 'TPBank (Ngân hàng Tiên Phong)',
                    bankCode: 'TPB',
                    accountNumber: '81836101820',
                    accountHolder: 'NGUYEN THI NGOC ANH',
                    transferSyntaxTemplate: 'DEVER [MSSV] [HoTen]',
                    qrTemplateUrl: 'https://img.vietqr.io/image/TPB-81836101820-compact2.png?amount=100000&addInfo=DEVER%20MSSV%20HoTen&accountName=NGUYEN%20THI%20NGOC%20ANH',
                    customQrUrl: '/images/treasurer-qr.png',
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

        const { campaignId, proofImageUrl, transactionCode, note } = req.body;

        if (!campaignId || !proofImageUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp đầy đủ mã chiến dịch và hình ảnh minh chứng chuyển khoản',
            });
        }

        // Database protection guard: prevent storing huge Base64 strings into MongoDB
        if (typeof proofImageUrl === 'string' && (proofImageUrl.startsWith('data:image/') || proofImageUrl.length > 10000)) {
            return res.status(400).json({
                status: 'error',
                message: 'Hình ảnh minh chứng phải được tải lên hệ thống lưu trữ Cloudflare R2 trước khi xác nhận (không chấp nhận chuỗi Base64).',
            });
        }

        const campaign = await FundCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ status: 'error', message: 'Kỳ thu quỹ không tồn tại' });
        }

        const user = await User.findById(userId);
        const userName = user ? [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname || 'Thành viên DEVER' : 'Thành viên';
        const userMSSV = user?.MSSV || 'N/A';

        // The payable amount is always the campaign's — never trust the client body.
        const payableAmount = campaign.amount;
        // Check if there is already an existing payment for this campaign
        let payment = await FundPayment.findOne({ campaignId, userId });
        if (payment) {
            payment.proofImageUrl = proofImageUrl;
            payment.transactionCode = transactionCode || payment.transactionCode;
            payment.note = note || payment.note;
            payment.amount = payableAmount;
            payment.status = 'pending';
            payment.reviewNotes = '';
            await payment.save();
        } else {
            payment = await FundPayment.create({
                campaignId,
                userId,
                amount: payableAmount,
                proofImageUrl,
                transactionCode: transactionCode || '',
                note: note || '',
                status: 'pending',
            });
        }

        // Send Telegram notification to Admin
        const formattedAmount = payableAmount.toLocaleString('vi-VN') + ' đ';
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
        recordFundAudit({
            paymentId: payment._id,
            campaignId,
            payerId: userId,
            action: 'submitted',
            actorId: userId,
            amount: payableAmount,
            note: note || '',
        });

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
        const campaigns = await FundCampaign.find({}).sort({ createdAt: -1 }).lean();

        // One aggregate for all campaigns instead of 3 count queries per campaign.
        const paymentStats = await FundPayment.aggregate([
            {
                $group: {
                    _id: '$campaignId',
                    totalPayments: { $sum: 1 },
                    approvedPayments: {
                        $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                    },
                    pendingPayments: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                    },
                },
            },
        ]);
        const statsByCampaign = new Map(
            paymentStats.map((row: any) => [String(row._id), row]),
        );

        const campaignsWithStats = campaigns.map((c: any) => {
            const stats = statsByCampaign.get(String(c._id)) || {
                totalPayments: 0,
                approvedPayments: 0,
                pendingPayments: 0,
            };
            return {
                ...c,
                stats: {
                    totalPayments: stats.totalPayments,
                    approvedPayments: stats.approvedPayments,
                    pendingPayments: stats.pendingPayments,
                    totalCollected: stats.approvedPayments * c.amount,
                },
            };
        });

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
        // Whitelist updatable fields — never mass-assign req.body (blocks _id/createdBy injection).
        const ALLOWED_CAMPAIGN_FIELDS = [
            'title',
            'description',
            'amount',
            'startDate',
            'deadline',
            'semester',
            'status',
            'targetTotalAmount',
        ];
        const ALLOWED_BANK_FIELDS = [
            'bankName',
            'bankCode',
            'accountNumber',
            'accountHolder',
            'transferSyntaxTemplate',
            'qrTemplateUrl',
            'customQrUrl',
        ];
        const payload: Record<string, unknown> = {};
        for (const key of ALLOWED_CAMPAIGN_FIELDS) {
            if ((req.body || {})[key] !== undefined) {
                payload[key] = (req.body || {})[key];
            }
        }
        const bankInfo = (req.body || {}).bankInfo;
        if (bankInfo && typeof bankInfo === 'object' && !Array.isArray(bankInfo)) {
            const bankPayload: Record<string, unknown> = {};
            for (const key of ALLOWED_BANK_FIELDS) {
                if ((bankInfo as Record<string, unknown>)[key] !== undefined) {
                    bankPayload[key] = (bankInfo as Record<string, unknown>)[key];
                }
            }
            payload.bankInfo = bankPayload;
        }
        const updated = await FundCampaign.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
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
        recordFundAudit({
            paymentId: payment._id,
            campaignId: payment.campaignId,
            payerId: payment.userId,
            action: status as 'approved' | 'rejected',
            actorId: adminId || null,
            amount: payment.amount,
            note: reviewNotes || '',
        });

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
 * 9. Admin: Append-only audit trail for payment proofs
 */
export const getAdminAuditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 24, 1), 100);
        const skip = (page - 1) * limit;
        const filter: Record<string, unknown> = {};
        if (typeof req.query.campaignId === 'string' && req.query.campaignId) {
            filter.campaignId = req.query.campaignId;
        }
        if (typeof req.query.paymentId === 'string' && req.query.paymentId) {
            filter.paymentId = req.query.paymentId;
        }
        if (typeof req.query.action === 'string' && ['submitted', 'approved', 'rejected'].includes(req.query.action)) {
            filter.action = req.query.action;
        }

        const [entries, total] = await Promise.all([
            FundAuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('payerId', 'firstname lastname email')
                .populate('actorId', 'firstname lastname email')
                .populate('campaignId', 'title amount')
                .lean(),
            FundAuditLog.countDocuments(filter),
        ]);

        return res.status(200).json({
            status: 'success',
            results: entries.length,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data: entries,
        });
    } catch (error) {
        return next(error);
    }
};
/**
 * 10. Admin: Financial analytics
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
            const [counts] = await FundPayment.aggregate([
                { $match: { campaignId: activeCampaign._id } },
                {
                    $group: {
                        _id: null,
                        approved: {
                            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                        },
                        pending: {
                            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                        },
                        rejected: {
                            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
                        },
                    },
                },
            ]);
            totalApproved = counts?.approved ?? 0;
            totalPending = counts?.pending ?? 0;
            totalRejected = counts?.rejected ?? 0;
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
