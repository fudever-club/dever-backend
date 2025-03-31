import { NextFunction } from 'express';
import { generateAlbumUniqueSlug } from '../Utils/generateSlug';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const imageSchema = new Schema(
    {
        url: {
            type: String,
            required: true,
        },
    },
    { _id: false },
); // prevent MongoDB from adding _id fields to the image objects

const albumSchema = new Schema(
    {
        name: {
            type: String,
            unique: true,
            required: [true, 'User must be required'],
        },
        description: {
            type: String,
            required: [true, 'Description must be required'],
            trim: true,
        },
        imageList: [imageSchema],
        slug: {
            type: String,
        },
    },
    { timestamps: true },
);

albumSchema.pre('save', async function (this: any, next: NextFunction) {
    if (this.isModified('name')) {
        this.slug = await generateAlbumUniqueSlug(this);
    }
    next();
});

export const Album = mongoose.model('Album', albumSchema);
