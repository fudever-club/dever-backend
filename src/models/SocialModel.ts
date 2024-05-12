const mongoose = require('mongoose');

const socialSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name must be required'],
        },
        constant: {
            type: String,
            required: [true, 'constant must be required'],
            unique: true,
        },
    },
    { timestamps: true },
);

export const Social = mongoose.model('Social', socialSchema);
