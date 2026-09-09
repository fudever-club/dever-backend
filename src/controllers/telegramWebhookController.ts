import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { observabilityService } from '../services/observabilityService';
import { invalidateCache, memoryCache } from '../services/cacheService';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8654509084:AAH7GQSE7AE_O390qVMz14-rOP_eMDkepnc';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '7465099987';

/**
 * Send reply with custom keyboard buttons to Telegram chat
 */
const replyTelegram = async (chatId: string | number, text: string, showKeyboard: boolean = true) => {
    try {
        const keyboard = {
            keyboard: [
                [{ text: '🩺 Health & Uptime' }, { text: '📊 Thống Kê Nhanh' }],
                [{ text: '🐞 Lỗi Gần Nhất' }, { text: '🧹 Xóa Cache' }],
                [{ text: '❓ Trợ Giúp' }],
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
 * 1. Webhook endpoint for Telegram interactive commands
 */
export const handleTelegramWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const message = req.body?.message || req.body?.edited_message;
        if (!message || !message.text) {
            return res.status(200).json({ ok: true, note: 'No text message' });
        }

        const chatId = message.chat?.id;
        const rawText = (message.text || '').trim();
        const fromUser = message.from?.username ? `@${message.from.username}` : message.from?.first_name || 'User';

        // Security check: Only Admin chat ID is authorized to command the bot
        if (chatId.toString() !== TELEGRAM_ADMIN_CHAT_ID.toString()) {
            console.warn(`[Telegram Security] Unauthorized command attempt from chat ${chatId} (${fromUser}): ${rawText}`);
            await replyTelegram(
                chatId,
                `⛔ <b>Từ chối quyền truy cập!</b>\nBạn không có quyền tương tác với hệ thống điều hành FU-DEVER. Sự kiện đã được ghi nhận.`,
                false
            );
            return res.status(200).json({ ok: true });
        }

        const command = rawText.toLowerCase();

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
            return res.status(200).json({ ok: true });
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
            return res.status(200).json({ ok: true });
        }

        // 3. /errors or "🐞 Lỗi Gần Nhất"
        if (command === '/errors' || rawText === '🐞 Lỗi Gần Nhất') {
            const recentErrors = observabilityService.getRecentErrors(5);
            if (recentErrors.length === 0) {
                await replyTelegram(
                    chatId,
                    `🎉 <b>Tuyệt vời!</b>\nKhông có lỗi nào được ghi nhận gần đây trong bộ đệm hệ thống.`
                );
                return res.status(200).json({ ok: true });
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
            return res.status(200).json({ ok: true });
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
            return res.status(200).json({ ok: true });
        }

        // 5. /start or /help or default
        const helpMsg = `
🤖 <b>[FU-DEVER POCKET DEVOPS BOT]</b>
Xin chào Ban Quản Trị! Dưới đây là các câu lệnh điều khiển hệ thống:

🩺 <b>/health</b>: Tra cứu Uptime, RAM, DB Status & Tỉ lệ Cache Hit
📊 <b>/stats</b>: Báo cáo số lượng thành viên, blog chờ duyệt, quỹ
🐞 <b>/errors</b>: Xem 5 lỗi mới nhất trong hệ thống
🧹 <b>/clearcache [group]</b>: Xóa cache khẩn cấp (vd: <code>/clearcache blogs</code> hoặc <code>/clearcache all</code>)
❓ <b>/help</b>: Xem menu hướng dẫn này

<i>Bạn cũng có thể bấm các nút thao tác nhanh ngay bên dưới bàn phím!</i>
        `.trim();

        await replyTelegram(chatId, helpMsg);
        return res.status(200).json({ ok: true });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Endpoint for Client ErrorBoundary to report runtime crashes
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
