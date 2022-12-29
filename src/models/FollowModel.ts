const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
import { Request, Response, NextFunction } from 'express';

const followSchema = mongoose.Schema(
    {
        userId: {
            type: String,
        },
        followedId: {
            type: String,
        },
    },
    { timestamps: true },
);

export const Follow = mongoose.model('Follow', followSchema);
