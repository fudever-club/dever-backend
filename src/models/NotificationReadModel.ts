import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-reader read receipts for notifications. Broadcasts keep a single shared
 * document with a global flag untouched: each member's read state lives here,
 * so one reader can never flip what another reader sees.
 */
export interface INotificationRead extends Document {
    userId: mongoose.Types.ObjectId;
    notificationId: mongoose.Types.ObjectId;
    readAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const notificationReadSchema = new Schema<INotificationRead>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        notificationId: { type: Schema.Types.ObjectId, ref: 'Notification', required: true, index: true },
        readAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

notificationReadSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

export const NotificationRead = mongoose.model<INotificationRead>('NotificationRead', notificationReadSchema);
