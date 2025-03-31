const mongoose = require('mongoose');

const leaderboardSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User must be required'],
            unique: true,
        },
        leetcodeUsername: {
            type: String,
            required: [true, 'Leetcode username must be required'],
            trim: true,
        },
        acSubmissionList: [
            {
                id: String,
                title: String,
                titleSlug: String,
                timestamp: String,
                date: String,
            },
        ],
    },
    { timestamps: true },
);

export const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
