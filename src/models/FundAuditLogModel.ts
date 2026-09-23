import mongoose, { Schema, Document } from 'mongoose';

/**
 * Append-only audit trail for fund payment proofs. Rows are never updated or
 * deleted by application code: every submit/review action appends one entry,
 * so status flips on FundPayment remain fully traceable.
 */
export type FundAuditAction = 'submitted' | 'approved' | 'rejected';

export interface IFundAuditLog extends Document {
    paymentId: mongoose.Types.ObjectId;
    campaignId: mongoose.Types.ObjectId;
    payerId: mongoose.Types.ObjectId;
    action: FundAuditAction;
    actorId: mongoose.Types.ObjectId | null;
    amount: number;
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

const fundAuditLogSchema = new Schema<IFundAuditLog>(
    {
        paymentId: { type: Schema.Types.ObjectId, ref: 'FundPayment', required: true, index: true },
        campaignId: { type: Schema.Types.ObjectId, ref: 'FundCampaign', required: true, index: true },
        payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        action: { type: String, enum: ['submitted', 'approved', 'rejected'], required: true },
        actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        amount: { type: Number, required: true },
        note: { type: String, default: '', trim: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

export const FundAuditLog = mongoose.model<IFundAuditLog>('FundAuditLog', fundAuditLogSchema);
