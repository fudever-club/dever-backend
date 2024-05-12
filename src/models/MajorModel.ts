const mongoose = require('mongoose');

const majorSchema = mongoose.Schema(
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

export const Major = mongoose.model('Major', majorSchema);
