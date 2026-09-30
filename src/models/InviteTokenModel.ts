import mongoose, { Schema, Document } from 'mongoose';
import { createHash } from 'crypto';

/**
 * Single-use invitation tokens (invite-only onboarding, no self-registration).
 * Admin creates an invite per email; the recipient sets their own password via
 * the public accept endpoint. Rows are never deleted: consumed tokens stay as
 * an audit trail (accepted/revoked), expiry is computed from expiresAt.
 */
export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface IInviteToken extends Document {
    email: string;
    firstname: string;
    lastname: string;
    tokenHash: string;
    invitedBy: mongoose.Types.ObjectId | null;
    status: InviteStatus;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
}

const inviteTokenSchema = new Schema<IInviteToken>(
    {
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        firstname: { type: String, default: '', trim: true },
        lastname: { type: String, default: '', trim: true },
        // SHA-256 of the plaintext token handed once to the admin.
        // The plaintext itself is never stored.
        tokenHash: { type: String, required: true, unique: true, index: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'revoked'],
            default: 'pending',
            index: true,
        },
        expiresAt: { type: Date, required: true, index: true },
        acceptedAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

export const hashInviteToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

export const InviteToken = mongoose.model<IInviteToken>('InviteToken', inviteTokenSchema);
