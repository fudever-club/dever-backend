import crypto from 'crypto';
import mongoose from 'mongoose';
import { sendTelegramMessage } from './telegramService';
import { memoryCache } from './cacheService';
import { User } from '../models/UserModel';
import { Blog } from '../models/BlogModel';
import { FundPayment } from '../models/FundPaymentModel';
import { Leaderboard } from '../models/LeaderboardModel';

export interface SystemErrorEntry {
    id: string;
    timestamp: Date;
    source: 'backend' | 'client' | 'process';
    message: string;
    stack?: string;
    route?: string;
    method?: string;
    statusCode?: number;
    user?: string;
    ip?: string;
}

interface DebounceEntry {
    count: number;
    firstSeen: number;
    lastAlerted: number;
}

const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ERROR_BUFFER_SIZE = 20;

class ObservabilityManager {
    private errorBuffer: SystemErrorEntry[] = [];
    private debounceMap = new Map<string, DebounceEntry>();
    private startTime = Date.now();

    public recordError(entry: Omit<SystemErrorEntry, 'id' | 'timestamp'>): SystemErrorEntry {
        const fullEntry: SystemErrorEntry = {
            ...entry,
            id: crypto.randomBytes(4).toString('hex'),
            timestamp: new Date(),
        };

        this.errorBuffer.unshift(fullEntry);
        if (this.errorBuffer.length > MAX_ERROR_BUFFER_SIZE) {
            this.errorBuffer.pop();
        }

        return fullEntry;
    }

    public getRecentErrors(limit: number = 5): SystemErrorEntry[] {
        return this.errorBuffer.slice(0, limit);
    }

    public shouldAlert(fingerprint: string): { shouldAlert: boolean; count: number } {
        const now = Date.now();
        const existing = this.debounceMap.get(fingerprint);

        if (!existing || now - existing.lastAlerted > DEBOUNCE_WINDOW_MS) {
            this.debounceMap.set(fingerprint, {
                count: 1,
                firstSeen: now,
                lastAlerted: now,
            });
            return { shouldAlert: true, count: 1 };
        }

        existing.count += 1;
        return { shouldAlert: false, count: existing.count };
    }

    public async reportCriticalError(params: {
        source: 'backend' | 'client' | 'process';
        message: string;
        stack?: string;
        route?: string;
        method?: string;
        statusCode?: number;
        user?: string;
        ip?: string;
    }): Promise<boolean> {
        // Record into buffer first
        const record = this.recordError(params);

        // Build fingerprint for smart debouncing
        const firstLine = (params.stack || params.message || '').split('\n')[0] || 'unknown';
        const rawHash = `${params.source}:${params.route || ''}:${params.message}:${firstLine}`;
        const fingerprint = crypto.createHash('md5').update(rawHash).digest('hex');

        const { shouldAlert, count } = this.shouldAlert(fingerprint);

        if (!shouldAlert) {
            console.warn(`[Observability] Suppressed duplicate alert (${count}x in 5m): ${params.message}`);
            return false;
        }

        // Format Telegram HTML message
        const sourceEmoji = params.source === 'backend' ? '🖥️' : params.source === 'client' ? '🌐' : '⚙️';
        const sourceTitle = params.source === 'backend' ? 'BACKEND EXCEPTION' : params.source === 'client' ? 'CLIENT BROWSER CRASH' : 'PROCESS UNCAUGHT';
        const formattedTime = record.timestamp.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        const stackSnippet = params.stack
            ? params.stack
                  .split('\n')
                  .slice(0, 4)
                  .map((line) => line.trim())
                  .join('\n')
            : 'No stack trace available';

        const repeatText = count > 1 ? `\n⚠️ <i>(Sự cố đã lặp lại ${count} lần trong 5 phút vừa qua)</i>` : '';

        const alertHtml = `
🚨 <b>[FU-DEVER SYSTEM ALERT] ${sourceEmoji} ${sourceTitle}</b>

📌 <b>Thông điệp:</b> <code>${this.escapeHtml(params.message)}</code>
${params.route ? `📍 <b>Đường dẫn:</b> <code>${params.method || 'GET'} ${this.escapeHtml(params.route)}</code>\n` : ''}${params.statusCode ? `🔢 <b>Mã lỗi HTTP:</b> <code>${params.statusCode}</code>\n` : ''}${params.user ? `👤 <b>Người dùng:</b> <code>${this.escapeHtml(params.user)}</code>\n` : ''}${params.ip ? `🌐 <b>IP Client:</b> <code>${this.escapeHtml(params.ip)}</code>\n` : ''}⏱️ <b>Thời gian:</b> ${formattedTime}
${repeatText}
📋 <b>Stack Trace:</b>
<pre>${this.escapeHtml(stackSnippet)}</pre>
`.trim();

        await sendTelegramMessage(undefined, alertHtml, 'HTML').catch((err) => {
            console.error('[Observability Alert Dispatch Failed]:', err);
        });

        return true;
    }

    public getUptimeString(): string {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days} ngày`);
        if (hours > 0) parts.push(`${hours} giờ`);
        if (minutes > 0) parts.push(`${minutes} phút`);
        parts.push(`${seconds} giây`);

        return parts.join(' ');
    }

    public getSystemHealthMetrics() {
        const dbReady = mongoose.connection.readyState === 1;
        const dbStatus = dbReady ? '✅ Sẵn sàng (Connected)' : '❌ Mất kết nối (Disconnected)';

        const mem = process.memoryUsage();
        const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
        const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

        const cacheStats = memoryCache.getStats();
        const totalCacheReqs = cacheStats.hits + cacheStats.misses;
        const hitRate = totalCacheReqs > 0 ? ((cacheStats.hits / totalCacheReqs) * 100).toFixed(1) : '100';

        return {
            status: dbReady ? 'HEALTHY' : 'DEGRADED',
            dbStatus,
            uptime: this.getUptimeString(),
            memory: {
                rssMB,
                heapUsedMB,
                heapTotalMB,
            },
            cache: {
                size: cacheStats.size,
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                hitRate: `${hitRate}%`,
            },
            nodeVersion: process.version,
            platform: `${process.platform} (${process.arch})`,
            errorBufferCount: this.errorBuffer.length,
        };
    }

    public async getQuickStats() {
        const [userCount, pendingBlogs, pendingFunds, leetcodeCount] = await Promise.all([
            User.countDocuments().catch(() => 0),
            Blog.countDocuments({ status: 'pending_review' }).catch(() => 0),
            FundPayment.countDocuments({ status: 'pending' }).catch(() => 0),
            Leaderboard.countDocuments().catch(() => 0),
        ]);

        return {
            userCount,
            pendingBlogs,
            pendingFunds,
            leetcodeCount,
        };
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

export const observabilityService = new ObservabilityManager();
