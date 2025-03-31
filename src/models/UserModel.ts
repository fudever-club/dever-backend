const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
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
    },
    { timestamps: true },
);

userSchema.pre('save', async function (this: any, next: NextFunction) {
    const user = this;
    // console.log('🚀 ~ user:', user);
    // Hash password if it's new or has been modified
    if (user.isModified('password')) {
        await bcrypt.hash(user.password, 10, function (err: Error, hash: string) {
            if (err) {
                console.log('🚀 ~ err:', err);
                return next(err);
            } else {
                user.password = hash;
                console.log('🚀 ~ user:', user);
            }
        });
    }

    // Validate nickname uniqueness if it is set
    if (user.isModified('nickname') && user.nickname) {
        console.log('???????');

        const existingUser = await mongoose.models.User.findOne({ nickname: user.nickname });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return next(new Error('Nickname is already in use'));
        }
    }

    next();
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
    if (this.isModified('firstname') || this.isModified('lastname')) {
        this.slug = await generateUniqueSlug(this);
    }
    next();
});

// Generate slug from firstname and lastname before updating
// userSchema.pre('findOneAndUpdate', async function (this: any, next: NextFunction) {
//     const update = this.getUpdate() as any;
//     if (update.firstname || update.lastname) {
//         const firstname = update.firstname || this.getQuery().firstname;
//         const lastname = update.lastname || this.getQuery().lastname;
//         if (firstname && lastname) {
//             update.slug = await generateUniqueSlug({ firstname, lastname });
//         }
//     }
//     next();
// });

export const User = mongoose.model('User', userSchema);
