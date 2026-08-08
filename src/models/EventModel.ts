const mongoose = require('mongoose');

const eventSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
        },
        date: {
            type: String,
            required: [true, 'Date is required'],
        },
        time: {
            type: String,
            default: '14:00 - 17:00',
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
        },
        status: {
            type: String,
            default: 'Đang mở đăng ký',
        },
        speakers: {
            type: String,
            default: 'Ban Chuyên Môn FU-DEVER',
        },
        coverImage: {
            type: String,
            default: '',
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
        },
        registerUrl: {
            type: String,
            required: [true, 'Register Google Form URL is required'],
        },
        checkinUrl: {
            type: String,
            required: [true, 'Checkin Google Form URL is required'],
        },
    },
    { timestamps: true },
);

export const Event = mongoose.model('Event', eventSchema);
