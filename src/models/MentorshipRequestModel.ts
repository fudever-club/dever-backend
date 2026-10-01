import mongoose, { Schema, Document } from 'mongoose';

/**
 * Mentorship requests: members ask published mentors for guidance.
 * Contact exchange happens only after the mentor/admin accepts — the request
 * itself carries no phone/email, only the requester's member identity which
 * the mentor sees via populated firstname/lastname/gen.
 */
export const MENTORSHIP_TOPICS = [
    'Thuật toán & Phỏng vấn',
    'Web & Mobile',
    'AI & Machine Learning',
    'DevOps & Cloud',
    'Định hướng OJT & CV',
    'Quản lý Dự án & Kỹ năng',
] as const;

export type MentorshipStatus = 'pending' | 'accepted' | 'declined';

export interface IMentorshipRequest extends Document {
    alumniId: mongoose.Types.ObjectId;
    requesterId: mongoose.Types.ObjectId;
    topic: string;
    message: string;
    status: MentorshipStatus;
    reviewedBy: mongoose.Types.ObjectId | null;
    reviewedAt: Date | null;
    createdAt: Date;
}

const mentorshipRequestSchema = new Schema<IMentorshipRequest>(
    {
        alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true, index: true },
        requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        topic: { type: String, enum: [...MENTORSHIP_TOPICS], required: true },
        message: { type: String, default: '', trim: true, maxlength: 500 },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending',
            index: true,
        },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

mentorshipRequestSchema.index({ alumniId: 1, status: 1, createdAt: -1 });
mentorshipRequestSchema.index({ requesterId: 1, createdAt: -1 });
// One pending request per member per mentor — re-request after a decision.
mentorshipRequestSchema.index(
    { alumniId: 1, requesterId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const MentorshipRequest = mongoose.model<IMentorshipRequest>(
    'MentorshipRequest',
    mentorshipRequestSchema,
);
