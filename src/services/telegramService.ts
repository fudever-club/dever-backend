import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8654509084:AAH7GQSE7AE_O390qVMz14-rOP_eMDkepnc';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '7465099987';
const TELEGRAM_ENABLED = process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false';

/**
 * Core function to dispatch messages through Telegram Bot API
 */
export const sendTelegramMessage = async (
    chatId: string | number = TELEGRAM_ADMIN_CHAT_ID,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (!TELEGRAM_ENABLED || !TELEGRAM_BOT_TOKEN) {
        console.log('[TelegramBot] Notifications disabled or missing token.');
        return { success: false, error: 'Telegram notifications disabled or missing token' };
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(
            url,
            {
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                disable_web_page_preview: false,
            },
            { timeout: 8000 }
        );

        if (response.data && response.data.ok) {
            return { success: true, data: response.data.result };
        }
        return { success: false, error: response.data.description || 'Unknown Telegram error' };
    } catch (err: any) {
        console.error('[TelegramBot Error]:', err?.response?.data || err.message);
        return { success: false, error: err?.response?.data?.description || err.message };
    }
};

/**
 * 1. Alert Admin when a new Tech Blog is submitted for review
 */
export const notifyAdminNewBlogSubmission = async (blog: any, author: any) => {
    const authorName = author ? [author.firstname, author.lastname].filter(Boolean).join(' ') || author.nickname || author.email : 'Thành viên DEVER';
    const authorEmail = author?.email ? ` (${author.email})` : '';
    const category = blog.category || 'Tech Blog';
    const tags = Array.isArray(blog.tags) && blog.tags.length > 0 ? blog.tags.map((t: string) => `#${t}`).join(' ') : '#DEVER_Blog';
    const adminUrl = process.env.ADMIN_URL || 'https://admin.fudever.com';
    const landingUrl = process.env.LANDING_URL || 'https://fudever.com';
    const clientUrl = process.env.CLIENT_URL || 'https://client.fudever.com';

    const reviewUrl = `${adminUrl}/vi/blog-management`;

    const message = `
📝 <b>[FU-DEVER TECH BLOG] CÓ BÀI VIẾT MỚI GỬI DUYỆT!</b>

📌 <b>Tiêu đề:</b> ${blog.title || 'Bài viết không tên'}
👤 <b>Tác giả:</b> ${authorName}${authorEmail}
🏷️ <b>Chuyên mục:</b> ${category}
🔖 <b>Tags:</b> ${tags}
⏱️ <b>Thời gian đọc:</b> ${blog.readTime || '5 phút đọc'}
📅 <b>Gửi lúc:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

👉 <a href="${reviewUrl}"><b>BẤM VÀO ĐÂY ĐỂ DUYỆT BÀI NGAY TRÊN ADMIN DASHBOARD</b></a>
`.trim();

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
};

/**
 * 2. Alert when a blog post is approved / rejected / requested changes
 */
export const notifyBlogReviewResult = async (blog: any, status: string, reviewNotes?: string) => {
    const isApproved = status === 'published';
    const isRejected = status === 'rejected';
    const statusText = isApproved ? '✅ ĐÃ ĐƯỢC XUẤT BẢN' : isRejected ? '❌ BỊ TỪ CHỐI' : '⚠️ YÊU CẦU CHỈNH SỬA';
    const landingUrl = process.env.LANDING_URL || 'https://fudever.com';
    const clientUrl = process.env.CLIENT_URL || 'https://client.fudever.com';
    const blogUrl = isApproved
        ? `${landingUrl}/blog/${blog.slug}`
        : `${clientUrl}/vi/create-blog`;

    const message = `
🔔 <b>[FU-DEVER TECH BLOG] KẾT QUẢ DUYỆT BÀI VIẾT</b>

📌 <b>Tiêu đề:</b> ${blog.title}
🎯 <b>Trạng thái mới:</b> <b>${statusText}</b>
${reviewNotes ? `💬 <b>Ghi chú từ Admin:</b> <i>${reviewNotes}</i>\n` : ''}
${isApproved ? `🎁 <b>Phần thưởng:</b> +100 EXP & Mở khóa Huy hiệu Tác giả!\n` : ''}
👉 <a href="${blogUrl}"><b>${isApproved ? 'XEM BÀI VIẾT TRÊN LANDING' : 'MỞ BÀI VIẾT TRÊN CLIENT'}</b></a>
`.trim();

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
};

/**
 * 3. Alert when a member achieves a major Gamification milestone
 */
export const notifyGamificationMilestone = async (user: any, milestoneInfo: { badgeTitle?: string; level?: number; streak?: number }) => {
    const userName = [user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.nickname || 'Thành viên DEVER';
    const clientUrl = process.env.CLIENT_URL || 'https://client.fudever.com';

    let detail = '';
    if (milestoneInfo.badgeTitle) {
        detail = `🏆 Đã mở khóa huy hiệu danh giá: <b>${milestoneInfo.badgeTitle}</b>`;
    } else if (milestoneInfo.level) {
        detail = `⚡ Đã thăng cấp lên: <b>Level ${milestoneInfo.level}</b>`;
    } else if (milestoneInfo.streak) {
        detail = `🔥 Đã duy trì chuỗi hoạt động: <b>${milestoneInfo.streak} ngày liên tiếp</b>`;
    }

    const message = `
🌟 <b>[FU-DEVER GAMIFICATION] CHÚC MỪNG THÀNH TÍCH MỚI!</b>

👤 <b>Thành viên:</b> ${userName}
${detail}
📅 <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

👉 <a href="${clientUrl}/vi/dashboard"><b>XEM BẢNG VINH DANH TRÊN DEVER CLIENT</b></a>
`.trim();

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
};

/**
 * 4. General System & Deployment Alert
 */
export const notifySystemAlert = async (title: string, detailMessage: string) => {
    const message = `
🚀 <b>[FU-DEVER SYSTEM ALERT] ${title}</b>

ℹ️ ${detailMessage}
📅 <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
};

/**
 * 5. Test Telegram connection
 */
export const testTelegramBotConnection = async (customChatId?: string | number) => {
    const target = customChatId || TELEGRAM_ADMIN_CHAT_ID;
    const testMsg = `
🤖 <b>[FU-DEVER BOT] KIỂM TRA KẾT NỐI THÀNH CÔNG!</b>

✅ Bot: <b>@Fudever_bot</b>
📡 Trạng thái: <b>Đang hoạt động ổn định</b>
⏱️ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
🎯 Target Chat ID: <code>${target}</code>

<i>Hệ thống thông báo tự động hóa FU-DEVER đã sẵn sàng!</i>
`.trim();

    return await sendTelegramMessage(target, testMsg);
};
