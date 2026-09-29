import mongoose, { Schema, Document } from 'mongoose';

/**
 * Append-only audit trail for general admin mutations. Rows are never updated
 * or deleted by application code: every privileged mutation appends one entry.
 * Extend the action enum later via migration when new audit events are added.
 */
export type AdminAuditAction =
    | 'user.role_granted'
    | 'user.role_revoked'
    | 'user.position_changed'
    | 'user.leadership_changed'
    | 'user.deleted'
    | 'user.password_reset'
    | 'fund.payment_approved'
    | 'fund.payment_rejected'
    | 'blog.reviewed'
    | 'opensource.approved'
    | 'opensource.rejected'
    | 'opensource.deleted';

export type AdminAuditTargetType =
    | 'user'
    | 'fund_payment'
    | 'blog'
    | 'open_source'
    | 'event'
    | 'project'
    | 'campaign'
    | 'position';

export interface IAdminAuditLog extends Document {
    actorId: mongoose.Types.ObjectId | null;
    action: AdminAuditAction;
    targetType: AdminAuditTargetType;
    targetId: string;
    summary: string;
    before?: unknown;
    after?: unknown;
    ip: string;
    createdAt: Date;
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
    {
        actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        action: {
            type: String,
            enum: [
                'user.role_granted',
                'user.role_revoked',
                'user.position_changed',
                'user.leadership_changed',
                'user.deleted',
                'user.password_reset',
                'fund.payment_approved',
                'fund.payment_rejected',
                'blog.reviewed',
                'opensource.approved',
                'opensource.rejected',
                'opensource.deleted',
            ],
            required: true,
        },
        targetType: {
            type: String,
            enum: ['user', 'fund_payment', 'blog', 'open_source', 'event', 'project', 'campaign', 'position'],
            required: true,
            index: true,
        },
        targetId: { type: String, required: true, index: true },
        summary: { type: String, default: '', trim: true, maxlength: 500 },
        // Never store password / temporaryPassword in before/after snapshots.
        before: { type: Schema.Types.Mixed, default: undefined },
        after: { type: Schema.Types.Mixed, default: undefined },
        ip: { type: String, default: '' },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, createdAt: -1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema);

/** Best-effort audit write: a logging failure must never fail the admin flow. */
export const recordAdminAudit = (
    entry: {
        actorId: unknown;
        action: AdminAuditAction;
        targetType: AdminAuditTargetType;
        targetId: unknown;
        summary?: string;
        before?: unknown;
        after?: unknown;
        ip?: string;
    },
): void => {
    AdminAuditLog.create(entry as any).catch((err) => {
        console.error('[AdminAudit] write failed:', err?.message || err);
    });
};
