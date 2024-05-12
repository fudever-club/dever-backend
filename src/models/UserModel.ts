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
        },
        password: {
            type: String,
            required: [true, 'Password must be required'],
            minLength: [6, 'Password must be at least 6 characters'],
            trim: true,
        },
        description: {
            type: String,
            maxLength: [200, 'Your description is too long'],
            trim: true,
        },
        avatar: {
            type: String,
        },
        nickname: {
            type: String,
        },
        phone: {
            type: String,
        },

        firstname: {
            type: String,
            trim: true,
        },
        lastname: {
            type: String,
            trim: true,
        },
        dob: {
            type: Date,
        },
        hometown: {
            type: String,
            trim: true,
        },
        positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Position',
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
        },
        job: {
            type: String,
            trim: true,
        },
        workplace: {
            type: String,
            trim: true,
        },
        school: {
            type: String,
            trim: true,
        },
        majorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Major',
        },
        dateJoin: {
            type: Date,
        },
        favourites: [{ type: String }],
        skills: [{ type: String }],
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
