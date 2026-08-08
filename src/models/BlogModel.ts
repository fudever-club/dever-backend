const mongoose = require('mongoose');

const blogSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
        },
        slug: {
            type: String,
            required: [true, 'Slug is required'],
        },
        excerpt: {
            type: String,
            required: [true, 'Excerpt is required'],
        },
        content: {
            type: String,
            default: '',
        },
        category: {
            type: String,
            default: 'Web & Frontend',
        },
        author: {
            name: { type: String, default: 'Thành viên DEVER' },
            role: { type: String, default: 'Member' },
            avatar: { type: String, default: '/images/avatar/avatar.jpg' },
        },
        readTime: {
            type: String,
            default: '5 phút đọc',
        },
        likes: {
            type: Number,
            default: 0,
        },
        coverImage: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['published', 'draft'],
            default: 'published',
        },
    },
    { timestamps: true },
);

export const Blog = mongoose.model('Blog', blogSchema);
