const mongoose = require('mongoose');

const alumniSchema = mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        graduationGen: { type: String, default: null, trim: true },
        headline: { type: String, required: true, trim: true },
        bio: { type: String, default: null, trim: true },
        workplace: { type: String, default: null, trim: true },
        avatar: { type: String, default: null, trim: true },
        profileUrl: { type: String, default: null, trim: true },
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export const Alumni = mongoose.model('Alumni', alumniSchema);
