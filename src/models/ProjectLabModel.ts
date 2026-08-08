const mongoose = require('mongoose');

const projectLabSchema = mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        summary: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        status: { type: String, enum: ['open', 'paused', 'closed'], default: 'open' },
        roles: { type: [String], default: [] },
        contactUrl: { type: String, default: null, trim: true },
        coverImage: { type: String, default: null, trim: true },
    },
    { timestamps: true },
);

export const ProjectLab = mongoose.model('ProjectLab', projectLabSchema);
