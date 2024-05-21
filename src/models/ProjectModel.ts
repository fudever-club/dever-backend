import { NextFunction } from 'express';
import { generateProjectUniqueSlug } from '../Utils/generateSlug';

const mongoose = require('mongoose');

const projectSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title must be required'],
        },
        description: {
            type: String,
            required: [true, 'Description must be required'],
        },
        image: {
            type: String,
            required: [true, 'Image must be required'],
        },
        subDescription: {
            type: String,
            required: [true, 'Sub Description must be required'],
        },
        slug: {
            type: String,
            unique: true,
        },
    },
    { timestamps: true },
);

projectSchema.pre('save', async function (this: any, next: NextFunction) {
    console.log('1111');

    if (this.isModified('title')) {
        console.log('222');

        this.slug = await generateProjectUniqueSlug(this);
        console.log('333');
    }
    next();
});

// Generate slug from title before updating
projectSchema.pre('findOneAndUpdate', async function (this: any, next: NextFunction) {
    const update = this.getUpdate();
    if (update.title) {
        const title = update.title;
        if (title) {
            update.slug = await generateProjectUniqueSlug({ title });
        }
    }
    next();
});

export const Project = mongoose.model('Project', projectSchema);
