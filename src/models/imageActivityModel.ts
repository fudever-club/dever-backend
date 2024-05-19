const mongoose = require('mongoose');

const imageActivitySchema = mongoose.Schema(
    {
        url: {
            type: String,
            required: [true, 'Name must be required'],
        },
    },
    { timestamps: true },
);

export const ImageActivity = mongoose.model('ImageActivity', imageActivitySchema);
