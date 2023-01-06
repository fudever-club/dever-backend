const mongoose = require('mongoose');

const watchlistSchema = mongoose.Schema(
    {
        userId: {
            type: String,
        },
        tokenId: {
            type: String,
        },
    },
    { timestamps: true },
);

export const Watchlist = mongoose.model('Watchlist', watchlistSchema);
