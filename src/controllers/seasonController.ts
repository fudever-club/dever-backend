import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Leaderboard } from '../models/LeaderboardModel';
import { Season, SeasonQuestionCache } from '../models/SeasonModel';
import { toPublicProfileKey } from '../Utils/userDto';
import { recordAdminAudit } from '../models/AdminAuditLogModel';

const axios = require('axios');

const DIFFICULTY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DIFFICULTY_REFRESH_CAP = 100;

/** Fetch one question difficulty from LeetCode (null when unknown/failed). */
export const fetchQuestionDifficulty = async (
    titleSlug: string,
): Promise<'Easy' | 'Medium' | 'Hard' | null> => {
    try {
        const response = await axios.post(
            'https://leetcode.com/graphql/',
            {
                query: 'query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { difficulty } }',
                variables: { titleSlug },
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
        );
        const difficulty = response?.data?.data?.question?.difficulty;
        return ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : null;
    } catch {
        return null;
    }
};

/**
 * Refresh cached difficulties for slugs missing or older than 30d.
 * Bounded + concurrency-capped so the admin sync cannot fan out unbounded.
 * Sync path only — the public leaderboard never calls LeetCode.
 */
export const refreshQuestionDifficulties = async (titleSlugs: string[]): Promise<number> => {
    const unique = Array.from(new Set(titleSlugs.filter(Boolean))).slice(0, DIFFICULTY_REFRESH_CAP);
    if (unique.length === 0) return 0;
    const cached = await SeasonQuestionCache.find({ titleSlug: { $in: unique } }).select('titleSlug cachedAt');
    const fresh = new Set(
        cached
            .filter((c: any) => Date.now() - new Date(c.cachedAt).getTime() < DIFFICULTY_TTL_MS)
            .map((c: any) => c.titleSlug),
    );
    const stale = unique.filter((slug) => !fresh.has(slug));
    let updated = 0;
    for (let i = 0; i < stale.length; i += 5) {
        const batch = stale.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (slug) => ({ slug, difficulty: await fetchQuestionDifficulty(slug) })));
        const ops = results
            .filter((r) => r.difficulty)
            .map((r) => ({
                updateOne: {
                    filter: { titleSlug: r.slug },
                    update: { $set: { difficulty: r.difficulty, cachedAt: new Date() } },
                    upsert: true,
                },
            }));
        if (ops.length > 0) {
            await SeasonQuestionCache.bulkWrite(ops);
            updated += ops.length;
        }
    }
    return updated;
};

const toSeasonDto = (season: any) => ({
    _id: season._id,
    name: season.name,
    startDate: season.startDate,
    endDate: season.endDate,
    status: season.status,
    scoring: season.scoring,
    bracket: season.bracket || 'open',
    newbieGenCutoff: season.newbieGenCutoff ?? null,
});

const parseBracket = (value: unknown, fallback: 'open' | 'newbie' | 'pro' = 'open') =>
    value === 'newbie' || value === 'pro' || value === 'open' ? value : fallback;

const parseCutoff = (value: unknown): number | null | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
};

/** Public season list (newest first). */
export const getSeasons = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const seasons = await Season.find({}).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ status: 'success', results: seasons.length, data: seasons.map(toSeasonDto) });
    } catch (error) {
        return next(error);
    }
};

/** End every other active season — single-active guard. */
const endOtherActiveSeasons = async (exceptId?: string) => {
    const filter: Record<string, unknown> = { status: 'active' };
    if (exceptId) filter._id = { $ne: exceptId };
    await Season.updateMany(filter, { $set: { status: 'ended' } });
};

/** Admin-only season creation. */
export const createSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, startDate, endDate, status, scoring } = req.body || {};
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid name is required' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid start/end window is required' });
        }
        const seasonStatus = status === 'active' ? 'active' : 'upcoming';
        const points = (value: unknown, fallback: number) =>
            typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
        const bracket = parseBracket(req.body?.bracket);
        const cutoff = parseCutoff(req.body?.newbieGenCutoff);
        if (bracket !== 'open' && typeof cutoff !== 'number') {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid newbieGenCutoff is required for bracketed seasons' });
        }
        const season = await Season.create({
            name: name.trim(),
            startDate: start,
            endDate: end,
            status: seasonStatus,
            bracket,
            newbieGenCutoff: cutoff ?? null,
            scoring: {
                easy: points(scoring?.easy, 1),
                medium: points(scoring?.medium, 3),
                hard: points(scoring?.hard, 5),
            },
            createdBy: res.locals.auth?.userId || null,
        });
        if (seasonStatus === 'active') {
            await endOtherActiveSeasons(String(season._id));
        }
        recordAdminAudit({
            actorId: res.locals.auth?.userId || null,
            action: 'season.created',
            targetType: 'season',
            targetId: String(season._id),
            summary: `Season created: ${season.name}`.slice(0, 500),
            ip: req.ip || '',
        });
        return res.status(201).json({ status: 'success', data: toSeasonDto(season) });
    } catch (error) {
        return next(error);
    }
};

/** Admin-only season update. Ended seasons are locked; activating ends others. */
export const updateSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = await Season.findById(req.params.id);
        if (!season) {
            return res.status(404).json({ status: 'error', message: 'Season not found' });
        }
        if (season.status === 'ended') {
            return res.status(409).json({ status: 'error', message: 'Ended seasons are locked' });
        }
        const { name, startDate, endDate, status, scoring } = req.body || {};
        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
                return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid name is required' });
            }
            season.name = name.trim();
        }
        const start = startDate !== undefined ? new Date(startDate) : season.startDate;
        const end = endDate !== undefined ? new Date(endDate) : season.endDate;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid start/end window is required' });
        }
        season.startDate = start;
        season.endDate = end;
        if (scoring && typeof scoring === 'object') {
            const points = (value: unknown, fallback: number) =>
                typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
            season.scoring = {
                easy: points((scoring as any).easy, season.scoring.easy),
                medium: points((scoring as any).medium, season.scoring.medium),
                hard: points((scoring as any).hard, season.scoring.hard),
            };
        }
        const nextBracket = req.body?.bracket !== undefined ? parseBracket(req.body.bracket, season.bracket) : season.bracket;
        const nextCutoff = parseCutoff(req.body?.newbieGenCutoff);
        // Ending a season is always safe (it only shrinks exposure), so a
        // legacy row with an invalid bracket config can still be retired.
        const endingOnly = status === 'ended' && req.body?.bracket === undefined && req.body?.newbieGenCutoff === undefined;
        if (!endingOnly && nextCutoff === null) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid newbieGenCutoff is required for bracketed seasons' });
        }
        const effectiveCutoff = nextCutoff !== undefined ? nextCutoff : season.newbieGenCutoff;
        if (!endingOnly && nextBracket !== 'open' && (effectiveCutoff === null || effectiveCutoff === undefined)) {
            return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'A valid newbieGenCutoff is required for bracketed seasons' });
        }
        season.bracket = nextBracket;
        season.newbieGenCutoff = effectiveCutoff ?? null;
        let auditAction: 'season.updated' | 'season.ended' = 'season.updated';
        if (status !== undefined) {
            if (status !== 'upcoming' && status !== 'active' && status !== 'ended') {
                return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid status' });
            }
            season.status = status;
            if (status === 'active') {
                await endOtherActiveSeasons(String(season._id));
            }
            if (status === 'ended') {
                auditAction = 'season.ended';
            }
        }
        await season.save();
        recordAdminAudit({
            actorId: res.locals.auth?.userId || null,
            action: auditAction,
            targetType: 'season',
            targetId: String(season._id),
            summary: `Season ${auditAction === 'season.ended' ? 'ended' : 'updated'}: ${season.name}`.slice(0, 500),
            ip: req.ip || '',
        });
        return res.status(200).json({ status: 'success', data: toSeasonDto(season) });
    } catch (error) {
        return next(error);
    }
};

/**
 * Public season leaderboard: opt-in members only, submissions inside the
 * season window, unique problems, difficulty-weighted scoring from cache.
 * Unknown difficulties score as easy until the admin sync caches them.
 */
export const getSeasonLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let season: any = null;
        if (typeof req.query.seasonId === 'string' && req.query.seasonId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.seasonId)) {
                return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Invalid seasonId' });
            }
            season = await Season.findById(req.query.seasonId).lean();
            if (!season) {
                return res.status(404).json({ status: 'error', message: 'Season not found' });
            }
        } else {
            season = await Season.findOne({ status: 'active' }).sort({ createdAt: -1 }).lean();
            if (!season) {
                return res.status(404).json({ status: 'error', message: 'No active season', data: null });
            }
        }
        const startMs = new Date(season.startDate).getTime();
        const endMs = new Date(season.endDate).getTime();
        const entries = await Leaderboard.find({}).populate({
            path: 'userId',
            select: 'id firstname lastname avatar profileVisibility gen',
        });
        const cached = await SeasonQuestionCache.find({}).select('titleSlug difficulty').lean();
        const difficultyOf = new Map((cached || []).map((c: any) => [c.titleSlug, c.difficulty]));
        const scoring = season.scoring || { easy: 1, medium: 3, hard: 5 };
        let unknownTotal = 0;
        const bracket = season.bracket || 'open';
        const cutoff = season.newbieGenCutoff ?? null;
        const inBracket = (gen: unknown): boolean => {
            if (bracket === 'open' || cutoff === null) return true;
            if (typeof gen !== 'number') return false;
            return bracket === 'newbie' ? gen >= cutoff : gen < cutoff;
        };
        const board = entries
            .filter((entry: any) => entry.userId && entry.userId.profileVisibility?.leetcode === true)
            .filter((entry: any) => inBracket(entry.userId.gen))
            .map((entry: any) => {
                const seen = new Map<string, string>();
                for (const sub of entry.acSubmissionList || []) {
                    const ts = Number(sub?.timestamp) * 1000;
                    if (!sub?.titleSlug || Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
                    if (!seen.has(sub.titleSlug)) {
                        seen.set(sub.titleSlug, difficultyOf.get(sub.titleSlug) || 'Unknown');
                    }
                }
                let score = 0;
                const breakdown = { easy: 0, medium: 0, hard: 0, unknown: 0 };
                for (const difficulty of seen.values()) {
                    if (difficulty === 'Easy') {
                        score += scoring.easy;
                        breakdown.easy += 1;
                    } else if (difficulty === 'Medium') {
                        score += scoring.medium;
                        breakdown.medium += 1;
                    } else if (difficulty === 'Hard') {
                        score += scoring.hard;
                        breakdown.hard += 1;
                    } else {
                        score += scoring.easy;
                        breakdown.unknown += 1;
                        unknownTotal += 1;
                    }
                }
                return {
                    leetcodeUsername: entry.leetcodeUsername,
                    user: {
                        firstname: entry.userId.firstname || null,
                        lastname: entry.userId.lastname || null,
                        avatar: entry.userId.avatar || null,
                        profileKey: toPublicProfileKey(entry.userId),
                        gen: typeof entry.userId.gen === 'number' ? entry.userId.gen : null,
                    },
                    solved: seen.size,
                    score,
                    breakdown,
                };
            })
            .sort((a, b) => b.score - a.score || b.solved - a.solved);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
            status: 'success',
            data: {
                season: toSeasonDto(season),
                scoringComplete: unknownTotal === 0,
                entries: board,
            },
        });
    } catch (error) {
        return next(error);
    }
};
