import mongoose, { Schema, Document } from 'mongoose';

export interface IFundPayment extends Document {
    campaignId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    amount: number;
    proofImageUrl: string;
    transactionCode?: string;
    note?: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const fundPaymentSchema = new Schema<IFundPayment>(
    {
        campaignId: { type: Schema.Types.ObjectId, ref: 'FundCampaign', required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true },
        proofImageUrl: { type: String, required: true, trim: true },
        transactionCode: { type: String, default: '', trim: true },
        note: { type: String, default: '', trim: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
        reviewNotes: { type: String, default: '', trim: true },
    },
    { timestamps: true },
);

// Compound index so a user can easily be queried per campaign
fundPaymentSchema.index({ campaignId: 1, userId: 1 });

export const FundPayment = mongoose.model<IFundPayment>('FundPayment', fundPaymentSchema);
