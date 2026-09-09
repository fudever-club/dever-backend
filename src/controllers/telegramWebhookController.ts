import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { observabilityService } from '../services/observabilityService';
import { invalidateCache, memoryCache } from '../services/cacheService';
import { OpenSourceProject } from '../models/OpenSourceProjectModel';
import { User } from '../models/UserModel';
import { createNotification } from '../services/notificationService';
import {
    TELEGRAM_ADMIN_CHAT_ID,
    TELEGRAM_BOT_TOKEN,
    answerCallbackQuery,
    editTelegramMessageText,
    notifyAdminNewOpenSourceSubmission,
} from '../services/telegramService';

/**
 * Send reply with custom keyboard buttons to Telegram chat
 */
export const replyTelegram = async (chatId: string | number, text: string, showKeyboard: boolean = true) => {
    try {
        const keyboard = {
            keyboard: [
                [{ text: '🩺 Health & Uptime' }, { text: '📊 Thống Kê Nhanh' }],
                [{ text: '💻 Dự Án Chờ Duyệt' }, { text: '🐞 Lỗi Gần Nhất' }],
                [{ text: '🧹 Xóa Cache' }, { text: '❓ Trợ Giúp' }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
        };

        const payload: any = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        };

        if (showKeyboard) {
            payload.reply_markup = keyboard;
        }

        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            payload,
            { timeout: 8000 }
        );
    } catch (error: any) {
        console.error('[Telegram Reply Error]:', error?.response?.data || error.message);
    }
};

/**
 * Unified processor for Telegram commands (Invoked via Webhook OR Long Polling)
 */
export const processTelegramMessage = async (
    chatId: string | number,
    rawText: string,
    fromUser: string = 'User'
) => {
    // Security check: Only Admin chat ID is authorized to command the bot
    if (chatId.toString() !== TELEGRAM_ADMIN_CHAT_ID.toString()) {
        console.warn(`[Telegram Security] Unauthorized command attempt from chat ${chatId} (${fromUser}): ${rawText}`);
        await replyTelegram(
            chatId,
            `⛔ <b>Từ chối quyền truy cập!</b>\nBạn không có quyền tương tác với hệ thống điều hành FU-DEVER. Sự kiện đã được ghi nhận.`,
            false
        );
        return;
    }

    const command = rawText.toLowerCase().trim();

    // 1. /health or "🩺 Health & Uptime"
    if (command === '/health' || command === '/status' || rawText === '🩺 Health & Uptime') {
        const health = observabilityService.getSystemHealthMetrics();
        const reply = `
🩺 <b>[FU-DEVER SYSTEM HEALTH & METRICS]</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Trạng thái:</b> <b>${health.status === 'HEALTHY' ? '🟢 HOẠT ĐỘNG TỐT (HEALTHY)' : '🟡 CẢNH BÁO (DEGRADED)'}</b>
🗄️ <b>Cơ sở dữ liệu:</b> ${health.dbStatus}
⏱️ <b>Thời gian hoạt động:</b> ${health.uptime}
🧠 <b>Bộ nhớ RAM:</b>
  • RSS: <code>${health.memory.rssMB} MB</code>
  • Heap Used: <code>${health.memory.heapUsedMB} / ${health.memory.heapTotalMB} MB</code>
⚡ <b>Bộ nhớ đệm (Cache):</b>
  • Đang lưu: <code>${health.cache.size} keys</code>
  • Tỉ lệ trúng: <b>${health.cache.hitRate}</b> (${health.cache.hits} hits / ${health.cache.misses} misses)
⚙️ <b>Môi trường:</b> Node <code>${health.nodeVersion}</code> | <code>${health.platform}</code>
🐞 <b>Lỗi lưu trong Buffer:</b> <code>${health.errorBufferCount} sự cố</code>
        `.trim();

        await replyTelegram(chatId, reply);
        return;
    }

    // 2. /stats or "📊 Thống Kê Nhanh"
    if (command === '/stats' || rawText === '📊 Thống Kê Nhanh') {
        const stats = await observabilityService.getQuickStats();
        const reply = `
📊 <b>[FU-DEVER BÁO CÁO THỐNG KÊ NHANH]</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>Tổng số thành viên:</b> <b>${stats.userCount}</b> người dùng
📝 <b>Bài viết blog chờ duyệt:</b> <b>${stats.pendingBlogs}</b> bài
💰 <b>Biên lai nộp quỹ chờ xác nhận:</b> <b>${stats.pendingFunds}</b> đơn
🏆 <b>Thành viên liên kết LeetCode:</b> <b>${stats.leetcodeCount}</b> lập trình viên

👉 <i>Mọi chỉ số đều cập nhật trực tiếp theo thời gian thực từ MongoDB.</i>
        `.trim();

        await replyTelegram(chatId, reply);
        return;
    }

    // 3. /errors or "🐞 Lỗi Gần Nhất"
    if (command === '/errors' || rawText === '🐞 Lỗi Gần Nhất') {
        const recentErrors = observabilityService.getRecentErrors(5);
        if (recentErrors.length === 0) {
            await replyTelegram(
                chatId,
                `🎉 <b>Tuyệt vời!</b>\nKhông có lỗi nào được ghi nhận gần đây trong bộ đệm hệ thống.`
            );
            return;
        }

        let errorListHtml = `🐞 <b>[DANH SÁCH ${recentErrors.length} LỖI GẦN NHẤT]</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
        recentErrors.forEach((err, idx) => {
            const time = err.timestamp.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            errorListHtml += `
${idx + 1}. [${err.source.toUpperCase()}] <b>${err.message.slice(0, 100)}</b>
   📍 Route: <code>${err.method || 'GET'} ${err.route || 'N/A'}</code>
   🔢 Status: <code>${err.statusCode || 'N/A'}</code>
   ⏱️ Lúc: <i>${time}</i>
`;
        });

        await replyTelegram(chatId, errorListHtml.trim());
        return;
    }

    // 4. /clearcache or "🧹 Xóa Cache"
    if (command.startsWith('/clearcache') || rawText === '🧹 Xóa Cache') {
        const parts = rawText.split(' ');
        const targetGroup = parts[1]?.toLowerCase();

        let cleared = 0;
        if (!targetGroup || targetGroup === 'all') {
            cleared = memoryCache.clear();
        } else {
            cleared = invalidateCache(targetGroup);
        }

        const targetName = targetGroup ? `nhóm [${targetGroup}]` : 'toàn bộ hệ thống';
        await replyTelegram(
            chatId,
            `🧹 <b>Đã xóa thành công bộ nhớ cache!</b>\nĐã giải phóng <b>${cleared}</b> bản ghi cache ${targetName}.`
        );
        return;
    }

    // 5. /projects or /pending or "💻 Dự Án Chờ Duyệt"
    if (command === '/projects' || command === '/pending' || rawText === '💻 Dự Án Chờ Duyệt') {
        const pendingList = await OpenSourceProject.find({ isPublished: false }).sort({ createdAt: -1 });
        if (pendingList.length === 0) {
            await replyTelegram(
                chatId,
                `🎉 <b>Không có dự án nào đang chờ duyệt!</b>\nToàn bộ dự án cộng đồng gửi lên đều đã được xuất bản.`
            );
            return;
        }

        await replyTelegram(
            chatId,
            `📋 <b>[HÀNG ĐỢI DUYỆT DỰ ÁN]</b>\nHiện có <b>${pendingList.length}</b> dự án đang chờ duyệt. Danh sách chi tiết:`
        );

        for (const p of pendingList) {
            await notifyAdminNewOpenSourceSubmission(p, p.author || 'Thành viên DEVER');
        }
        return;
    }

    // 6. /start or /help or default
    const helpMsg = `
🤖 <b>[FU-DEVER POCKET DEVOPS BOT]</b>
Xin chào Ban Quản Trị! Dưới đây là các câu lệnh điều khiển hệ thống:

🩺 <b>/health</b>: Tra cứu Uptime, RAM, DB Status & Tỉ lệ Cache Hit
📊 <b>/stats</b>: Báo cáo số lượng thành viên, blog chờ duyệt, quỹ
💻 <b>/projects</b> (hoặc <b>/pending</b>): Duyệt nhanh các dự án mã nguồn mở thành viên gửi
🐞 <b>/errors</b>: Xem 5 lỗi mới nhất trong hệ thống
🧹 <b>/clearcache [group]</b>: Xóa cache khẩn cấp (vd: <code>/clearcache projects</code> hoặc <code>/clearcache all</code>)
❓ <b>/help</b>: Xem menu hướng dẫn này

<i>Bạn cũng có thể bấm các nút thao tác nhanh ngay bên dưới bàn phím!</i>
    `.trim();

    await replyTelegram(chatId, helpMsg);
};

/**
 * Handle Telegram Interactive Inline Button Callbacks (1-Click Approve / Reject)
 */
export const processTelegramCallbackQuery = async (callbackQuery: any) => {
    if (!callbackQuery) return;

    const queryId = callbackQuery.id;
    const data = (callbackQuery.data || '').trim();
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
    const messageId = callbackQuery.message?.message_id;
    const fromUser = callbackQuery.from?.username ? `@${callbackQuery.from.username}` : callbackQuery.from?.first_name || 'Admin';
    const originalText = callbackQuery.message?.text || '';

    // Security check: Only Admin chat ID can execute approve/reject callbacks
    if (chatId?.toString() !== TELEGRAM_ADMIN_CHAT_ID.toString()) {
        console.warn(`[Telegram Callback Security] Unauthorized callback from ${chatId} (${fromUser}): ${data}`);
        await answerCallbackQuery(queryId, '⛔ Bạn không có quyền thực hiện hành động này!', true);
        return;
    }

    const adminUrl = process.env.ADMIN_URL || 'https://admin.fudever.com';
    const reviewUrl = `${adminUrl}/vi/community-content?tab=opensource&filter=pending`;

    // 1. Approve Open Source Project: approve_project:<projectId>
    if (data.startsWith('approve_project:')) {
        const projectId = data.replace('approve_project:', '').trim();
        const project = await OpenSourceProject.findById(projectId);

        if (!project) {
            await answerCallbackQuery(queryId, '⚠️ Không tìm thấy dự án trong hệ thống!', true);
            return;
        }

        if (project.isPublished) {
            await answerCallbackQuery(queryId, 'ℹ️ Dự án này đã được phê duyệt từ trước.', false);
            return;
        }

        project.isPublished = true;
        await project.save();

        let authorName = project.author || 'Thành viên DEVER';
        if (project.authorId) {
            const author = await User.findById(project.authorId);
            if (author) {
                authorName = [author.firstname, author.lastname].filter(Boolean).join(' ') || author.nickname || authorName;
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
                    sendTelegram: false,
                }).catch(() => {});
            }
        }

        invalidateCache('projects');

        // Instant toast alert to Telegram user
        await answerCallbackQuery(queryId, '🎉 Đã phê duyệt! +150 EXP & Huy hiệu Core Contributor đã được trao.', false);

        // Edit original message to remove action buttons and display success confirmation
        if (messageId) {
            const updatedText = `
${originalText}

━━━━━━━━━━━━━━━━━━━━
✅ <b>ĐÃ PHÊ DUYỆT VÀ XUẤT BẢN THÀNH CÔNG</b>
👤 <b>Người duyệt:</b> ${fromUser}
⏱️ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();

            const singleButtonKeyboard = {
                inline_keyboard: [
                    [{ text: '🌐 Xem trên Admin Dashboard (Nội dung cộng đồng & Alumni)', url: reviewUrl }],
                ],
            };

            await editTelegramMessageText(chatId, messageId, updatedText, singleButtonKeyboard);
        }
        return;
    }

    // 2. Reject / Hide Open Source Project: reject_project:<projectId>
    if (data.startsWith('reject_project:')) {
        const projectId = data.replace('reject_project:', '').trim();
        const project = await OpenSourceProject.findById(projectId);

        if (!project) {
            await answerCallbackQuery(queryId, '⚠️ Không tìm thấy dự án!', true);
            return;
        }

        project.isPublished = false;
        await project.save();
        invalidateCache('projects');

        await answerCallbackQuery(queryId, '❌ Đã chuyển dự án về trạng thái Chưa xuất bản.', false);

        if (messageId) {
            const updatedText = `
${originalText}

━━━━━━━━━━━━━━━━━━━━
❌ <b>ĐÃ TỪ CHỐI / ẨN KHỎI SHOWCASE CÔNG KHAI</b>
👤 <b>Người xử lý:</b> ${fromUser}
⏱️ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();

            const singleButtonKeyboard = {
                inline_keyboard: [
                    [{ text: '🌐 Xem trên Admin Dashboard (Nội dung cộng đồng & Alumni)', url: reviewUrl }],
                ],
            };

            await editTelegramMessageText(chatId, messageId, updatedText, singleButtonKeyboard);
        }
        return;
    }
};

/**
 * Webhook endpoint for Telegram interactive commands
 */
export const handleTelegramWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.body?.callback_query) {
            await processTelegramCallbackQuery(req.body.callback_query);
            return res.status(200).json({ ok: true });
        }

        const message = req.body?.message || req.body?.edited_message;
        if (!message || !message.text) {
            return res.status(200).json({ ok: true, note: 'No text message' });
        }

        const chatId = message.chat?.id;
        const rawText = (message.text || '').trim();
        const fromUser = message.from?.username ? `@${message.from.username}` : message.from?.first_name || 'User';

        await processTelegramMessage(chatId, rawText, fromUser);
        return res.status(200).json({ ok: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Endpoint for Client ErrorBoundary to report runtime crashes
 */
export const reportClientError = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { message, stack, componentStack, url, userEmail } = req.body || {};
        if (!message) {
            return res.status(400).json({ status: 'error', message: 'Error message is required' });
        }

        observabilityService.reportCriticalError({
            source: 'client',
            message: typeof message === 'string' ? message.slice(0, 300) : 'Client error',
            stack: typeof stack === 'string' ? stack : typeof componentStack === 'string' ? componentStack : undefined,
            route: typeof url === 'string' ? url : req.get('referer') || undefined,
            user: userEmail || undefined,
            ip: req.ip || req.headers['x-forwarded-for']?.toString(),
        }).catch((err) => console.error('[Client Error Report Logging Failed]:', err));

        return res.status(200).json({
            status: 'success',
            message: 'Client error recorded and monitored',
        });
    } catch (error) {
        next(error);
    }
};
