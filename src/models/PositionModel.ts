const mongoose = require('mongoose');

const positionSchema = mongoose.Schema(
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

export const Position = mongoose.model('Position', positionSchema);
