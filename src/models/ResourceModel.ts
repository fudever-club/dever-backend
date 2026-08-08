const mongoose = require('mongoose');

const resourceSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
        },
        type: {
            type: String,
            enum: ['Slide', 'Source Code', 'Ebook / PDF'],
            default: 'Slide',
        },
        category: {
            type: String,
            enum: ['Web Dev', 'Backend', 'Algorithm', 'AI / Data'],
            default: 'Web Dev',
        },
        fileUrl: {
            type: String,
            required: [true, 'File URL is required'],
        },
        size: {
            type: String,
            default: 'Drive Link',
        },
    },
    { timestamps: true },
);

export const Resource = mongoose.model('Resource', resourceSchema);
