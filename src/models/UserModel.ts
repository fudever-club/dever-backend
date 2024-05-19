const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
import { NextFunction } from 'express';

const userSchema = mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, 'Email must be required'],
            trim: true,
            default: null,
        },
        password: {
            type: String,
            required: [true, 'Password must be required'],
            minLength: [6, 'Password must be at least 6 characters'],
            trim: true,
            default: null,
        },
        description: {
            type: String,
            maxLength: [200, 'Your description is too long'],
            trim: true,
            default: null,
        },
        avatar: {
            type: String,
            default: null,
        },
        nickname: {
            type: String,
            unique: true,
            default: null,
        },
        phone: {
            type: String,
            default: null,
        },

        firstname: {
            type: String,
            trim: true,
            default: null,
        },
        lastname: {
            type: String,
            trim: true,
            default: null,
        },
        dob: {
            type: Date,
            default: null,
        },
        hometown: {
            type: String,
            trim: true,
            default: null,
        },
        positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Position',
            default: null,
        },
        departments: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Department',
                default: null,
            },
        ],
        job: {
            type: String,
            trim: true,
            default: null,
        },
        workplace: {
            type: String,
            trim: true,
            default: null,
        },
        school: {
            type: String,
            trim: true,
            default: null,
        },
        majorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Major',
            default: null,
        },
        gen: {
            type: Number,
            default: null,
        },
        favourites: [{ type: String }],
        skills: [{ type: String }],
        isExcellent: {
            type: Boolean,
            default: false,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        MSSV: {
            type: String,
            default: null,
        },
    },
    { timestamps: true },
);

userSchema.pre('save', function (this: any, next: NextFunction) {
    let user = this;
    bcrypt.hash(user.password, 10, function (err: Error, hash: string) {
        if (err) {
            return next(err);
        } else {
            user.password = hash;
            next();
        }
    });
});

export const User = mongoose.model('User', userSchema);
