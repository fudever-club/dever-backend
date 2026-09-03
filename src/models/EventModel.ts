const mongoose = require('mongoose');

const safeUrlValidator = {
    validator: function (v: string) {
        if (!v || v === '#' || v.trim() === '') return true;
        return /^(https?:\/\/)/i.test(v.trim());
    },
    message: (props: { value: string }) => `${props.value} không phải là đường dẫn URL an toàn (phải bắt đầu bằng http:// hoặc https://)`,
};

const safeImageUrlValidator = {
    validator: function (v: string) {
        if (!v || v === '#' || v.trim() === '') return true;
        return /^(https?:\/\/|\/|data:image\/)/i.test(v.trim());
    },
    message: (props: { value: string }) => `${props.value} không phải là đường dẫn ảnh hợp lệ (phải bắt đầu bằng http://, https://, / hoặc data:image/)`,
};

const eventSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        date: {
            type: String,
            required: [true, 'Date is required'],
            trim: true,
        },
        time: {
            type: String,
            default: '14:00 - 17:00',
            trim: true,
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
            trim: true,
        },
        status: {
            type: String,
            default: 'Đang mở đăng ký',
            trim: true,
        },
        speakers: {
            type: String,
            default: 'Ban Chuyên Môn FU-DEVER',
            trim: true,
        },
        coverImage: {
            type: String,
            default: '/images/dever_blog_hero.png',
            validate: safeImageUrlValidator,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        registerUrl: {
            type: String,
            default: '#',
            validate: safeUrlValidator,
        },
        checkinUrl: {
            type: String,
            default: '#',
            validate: safeUrlValidator,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

export const Event = mongoose.model('Event', eventSchema);
