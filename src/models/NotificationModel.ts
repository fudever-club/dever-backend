import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    recipientId?: mongoose.Types.ObjectId | null;
    recipientRole: 'all' | 'admin' | 'member';
    type:
        | 'blog_submitted'
        | 'blog_approved'
        | 'blog_rejected'
        | 'blog_changes_requested'
        | 'badge_unlocked'
        | 'level_up'
        | 'streak_milestone'
        | 'event_created'
        | 'system_alert';
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    meta?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        recipientRole: {
            type: String,
            enum: ['all', 'admin', 'member'],
            default: 'member',
            index: true,
        },
        type: {
            type: String,
            enum: [
                'blog_submitted',
                'blog_approved',
                'blog_rejected',
                'blog_changes_requested',
                'badge_unlocked',
                'level_up',
                'streak_milestone',
                'event_created',
                'system_alert',
            ],
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Notification title is required'],
            trim: true,
        },
        message: {
            type: String,
            required: [true, 'Notification message is required'],
            trim: true,
        },
        link: {
            type: String,
            default: '',
            trim: true,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        meta: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
