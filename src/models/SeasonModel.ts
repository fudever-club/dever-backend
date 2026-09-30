import mongoose, { Schema, Document } from 'mongoose';

/**
 * Arena seasons: time-boxed LeetCode competitions. Scoring is difficulty
 * weighted (easy/medium/hard points, configurable per season). Only one
 * season may be active at a time — enforced in the controller, not by a
 * partial unique index, so history stays queryable.
 */
export type SeasonStatus = 'upcoming' | 'active' | 'ended';

export interface ISeason extends Document {
    name: string;
    startDate: Date;
    endDate: Date;
    status: SeasonStatus;
    scoring: { easy: number; medium: number; hard: number };
    createdBy: mongoose.Types.ObjectId | null;
    createdAt: Date;
}

const seasonSchema = new Schema<ISeason>(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        startDate: { type: Date, required: true, index: true },
        endDate: { type: Date, required: true, index: true },
        status: {
            type: String,
            enum: ['upcoming', 'active', 'ended'],
            default: 'upcoming',
            index: true,
        },
        scoring: {
            easy: { type: Number, default: 1, min: 0 },
            medium: { type: Number, default: 3, min: 0 },
            hard: { type: Number, default: 5, min: 0 },
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: { createdAt: true, updatedAt: true } },
);

export const Season = mongoose.model<ISeason>('Season', seasonSchema);

/**
 * Cached LeetCode question difficulties. Populated by the admin sync path
 * (bounded, 30-day refresh) so the public leaderboard never fans out to
 * LeetCode per request. Unknown slugs score as easy until cached.
 */
export interface ISeasonQuestionCache extends Document {
    titleSlug: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    cachedAt: Date;
}

const seasonQuestionCacheSchema = new Schema<ISeasonQuestionCache>(
    {
        titleSlug: { type: String, required: true, unique: true, index: true },
        difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
        cachedAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false },
);

export const SeasonQuestionCache = mongoose.model<ISeasonQuestionCache>(
    'SeasonQuestionCache',
    seasonQuestionCacheSchema,
);
