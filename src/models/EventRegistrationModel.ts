import mongoose, { Document, Schema } from 'mongoose';

export interface IEventRegistration extends Document {
    eventId: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId | null;
    userName: string;
    userEmail: string;
    userPhone?: string;
    userMSSV?: string;
    ticketCode: string;
    qrData: string;
    status: 'registered' | 'checked_in' | 'cancelled';
    checkedInAt?: Date | null;
    checkedInBy?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const eventRegistrationSchema = new Schema<IEventRegistration>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        userName: {
            type: String,
            required: [true, 'Attendee name is required'],
            trim: true,
        },
        userEmail: {
            type: String,
            required: [true, 'Attendee email is required'],
            trim: true,
        },
        userPhone: {
            type: String,
            default: '',
            trim: true,
        },
        userMSSV: {
            type: String,
            default: '',
            trim: true,
        },
        ticketCode: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        qrData: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['registered', 'checked_in', 'cancelled'],
            default: 'registered',
            index: true,
        },
        checkedInAt: {
            type: Date,
            default: null,
        },
        checkedInBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

eventRegistrationSchema.index({ eventId: 1, userEmail: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, status: 1 });

export const EventRegistration = mongoose.model<IEventRegistration>(
    'EventRegistration',
    eventRegistrationSchema
);
