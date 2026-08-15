const mongoose = require('mongoose');

const resourceSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
        },
        type: {
            type: String,
            default: 'Slide',
        },
        category: {
            type: String,
            default: 'Slide Workshop',
        },
        author: {
            type: String,
            default: 'Ban Chuyên Môn FU-DEVER',
        },
        description: {
            type: String,
            default: '',
        },
        fileUrl: {
            type: String,
            required: [true, 'File URL is required'],
        },
        size: {
            type: String,
            default: 'Drive Link',
        },
        fileName: {
            type: String,
            default: null,
        },
        mimeType: {
            type: String,
            default: null,
        },
        // Uploaded files are deliberately excluded from collection reads.
        // They are only loaded by the authenticated download endpoint.
        fileData: {
            type: String,
            default: null,
            select: false,
        },
    },
    { timestamps: true },
);

export const Resource = mongoose.model('Resource', resourceSchema);
