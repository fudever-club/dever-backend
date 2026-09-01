const mongoose = require('mongoose');

const alumniSchema = mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        name: { type: String, required: true, trim: true },
        graduationGen: { type: String, default: 'Gen 6', trim: true },
        headline: { type: String, required: true, trim: true },
        bio: { type: String, default: null, trim: true },
        quote: { type: String, default: null, trim: true },
        workplace: { type: String, default: null, trim: true },
        companyLogo: { type: String, default: null, trim: true },
        avatar: { type: String, default: null, trim: true },
        profileUrl: { type: String, default: null, trim: true },
        isMentor: { type: Boolean, default: true },
        isAdvisoryBoard: { type: Boolean, default: true },
        mentoringTopics: { type: [String], default: [] },
        advisoryAcceptedAt: { type: Date, default: null },
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export const Alumni = mongoose.model('Alumni', alumniSchema);
