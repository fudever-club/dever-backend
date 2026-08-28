const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
import { NextFunction } from 'express';
import { generateUniqueSlug } from '../Utils/generateSlug';

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
            default:
                'https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp',
        },
        nickname: {
            type: String,
            default: null,
        },
        slug: {
            type: String,
            default: null,
            index: true,
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
        isLeader: {
            type: Boolean,
            default: false,
        },
        MSSV: {
            type: String,
            default: null,
        },
        profileVisibility: {
            email: { type: Boolean, default: false },
            phone: { type: Boolean, default: false },
            MSSV: { type: Boolean, default: false },
            dob: { type: Boolean, default: false },
            hometown: { type: Boolean, default: false },
            school: { type: Boolean, default: false },
            workplace: { type: Boolean, default: false },
            job: { type: Boolean, default: false },
            socials: { type: Boolean, default: false },
            skills: { type: Boolean, default: false },
            favourites: { type: Boolean, default: false },
            description: { type: Boolean, default: false },
            nickname: { type: Boolean, default: false },
        },
        socials: [
            {
                url: {
                    type: String,
                    required: [true, 'Social url must be required'],
                },
                socialId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Social',
                    required: [true, 'Social id must be required'],
                },
            },
        ],
        exp: {
            type: Number,
            default: 150,
            min: 0,
        },
        streakDays: {
            type: Number,
            default: 1,
            min: 0,
        },
        lastCheckinDate: {
            type: Date,
            default: null,
        },
        unlockedBadges: [
            {
                badgeId: { type: String, required: true },
                unlockedAt: { type: Date, default: Date.now },
            },
        ],
        favoriteTrack: {
            title: { type: String, default: null, trim: true },
            artist: { type: String, default: null, trim: true },
            url: { type: String, default: null, trim: true },
        },
    },
    { timestamps: true },
);

userSchema.pre('save', async function (this: any, next: NextFunction) {
    const user = this;
    try {
        if (user.isModified('password')) {
            user.password = await bcrypt.hash(user.password, 10);
        }
        return next();
    } catch (error) {
        return next(error as Error);
    }
});

userSchema.pre('save', async function (this: any, next: NextFunction) {
    if (this.isModified('nickname') && this.nickname) {
        const existingUser = await mongoose.models.User.findOne({ nickname: this.nickname });
        if (existingUser && existingUser._id.toString() !== this._id.toString()) {
            return next(new Error('Nickname is already in use'));
        }
    }
    return next();
});

userSchema.pre('findOneAndUpdate', async function (this: any, next: NextFunction) {
    const update = this.getUpdate() as any;

    // Validate nickname uniqueness if it is being set
    if (update.nickname) {
        const query = this.getQuery();
        const user = await mongoose.models.User.findOne(query);
        const existingUser = await mongoose.models.User.findOne({ nickname: update.nickname });

        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return next(new Error('Nickname is already in use'));
        }
    }

    next();
});

userSchema.pre('save', async function (this: any, next: NextFunction) {
    if ((this.isModified('firstname') || this.isModified('lastname')) && (this.firstname || this.lastname)) {
        this.slug = await generateUniqueSlug(this);
    }
    next();
});

userSchema.index({ firstname: 'text', lastname: 'text', email: 'text', MSSV: 'text' });
userSchema.index({ positionId: 1, majorId: 1, gen: 1 });

export const User = mongoose.model('User', userSchema);
