import mongoose, { Schema, Document } from 'mongoose';

export interface IFundCampaign extends Document {
    title: string;
    description?: string;
    amount: number;
    startDate: Date;
    deadline: Date;
    semester: string;
    status: 'active' | 'closed' | 'upcoming';
    bankInfo: {
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
        transferSyntaxTemplate: string;
        qrTemplateUrl?: string;
    };
    targetTotalAmount?: number;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const fundCampaignSchema = new Schema<IFundCampaign>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        amount: { type: Number, required: true, default: 100000 },
        startDate: { type: Date, default: Date.now },
        deadline: { type: Date, required: true },
        semester: { type: String, default: 'Fall 2026', trim: true },
        status: { type: String, enum: ['active', 'closed', 'upcoming'], default: 'active' },
        bankInfo: {
            bankName: { type: String, default: 'MBBank (Ngân hàng Quân Đội)' },
            bankCode: { type: String, default: 'MB' },
            accountNumber: { type: String, default: '0912345678' },
            accountHolder: { type: String, default: 'CLB LAP TRINH FU DEVER' },
            transferSyntaxTemplate: { type: String, default: 'DEVER [MSSV] [HoTen]' },
            qrTemplateUrl: { type: String, default: '' },
        },
        targetTotalAmount: { type: Number, default: 5000000 },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
);

export const FundCampaign = mongoose.model<IFundCampaign>('FundCampaign', fundCampaignSchema);
