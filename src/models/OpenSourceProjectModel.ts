import mongoose from 'mongoose';

const openSourceProjectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Tên dự án là bắt buộc'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Mô tả dự án là bắt buộc'],
            trim: true,
        },
        author: {
            type: String,
            required: [true, 'Tên tác giả là bắt buộc'],
            trim: true,
            default: 'Thành viên DEVER',
        },
        stars: {
            type: Number,
            default: 0,
            min: 0,
        },
        githubUrl: {
            type: String,
            trim: true,
            default: 'https://github.com/fu-dever',
        },
        demoUrl: {
            type: String,
            trim: true,
            default: '',
        },
        category: {
            type: String,
            trim: true,
            default: 'Open Source',
        },
        tags: {
            type: [String],
            default: [],
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

export const OpenSourceProject = mongoose.model('OpenSourceProject', openSourceProjectSchema);
