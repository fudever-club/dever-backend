import axios from 'axios';
import { processTelegramMessage } from '../controllers/telegramWebhookController';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8654509084:AAH7GQSE7AE_O390qVMz14-rOP_eMDkepnc';
const TELEGRAM_ENABLED = process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false';

let isPolling = false;
let currentOffset = 0;

export const startTelegramPolling = async () => {
    if (!TELEGRAM_ENABLED || !TELEGRAM_BOT_TOKEN) {
        console.log('[Telegram Polling] Polling disabled or missing bot token.');
        return;
    }

    if (isPolling) return;
    isPolling = true;

    console.log('[Telegram Polling] Starting background long polling for @Fudever_bot...');

    const pollLoop = async () => {
        while (isPolling) {
            try {
                const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
                const params: any = {
                    timeout: 10,
                    allowed_updates: ['message'],
                };
                if (currentOffset > 0) {
                    params.offset = currentOffset;
                }

                const response = await axios.get(url, { params, timeout: 15000 });
                const updates = response.data?.result;

                if (Array.isArray(updates) && updates.length > 0) {
                    for (const update of updates) {
                        currentOffset = update.update_id + 1;

                        const message = update.message;
                        if (message && message.text) {
                            const chatId = message.chat?.id;
                            const rawText = message.text;
                            const fromUser = message.from?.username ? `@${message.from.username}` : message.from?.first_name || 'User';

                            console.log(`[Telegram Polling] Received command from ${chatId} (${fromUser}): ${rawText}`);
                            await processTelegramMessage(chatId, rawText, fromUser).catch((err) => {
                                console.error('[Telegram Polling Command Execution Error]:', err);
                            });
                        }
                    }
                }
            } catch (err: any) {
                // If 409 Conflict: another instance or webhook is active, wait longer
                const isConflict = err?.response?.status === 409;
                if (isConflict) {
                    // Webhook might be set, back off
                    await new Promise((resolve) => setTimeout(resolve, 10000));
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        }
    };

    // Run poll loop without blocking
    pollLoop().catch((err) => console.error('[Telegram Polling Loop Fatal Error]:', err));
};

export const stopTelegramPolling = () => {
    isPolling = false;
};
