const mongoose = require('mongoose');

const departmentSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name must be required'],
        },
        constant: {
            type: String,
            required: [true, 'Constant must be required'],
        },
    },
    { timestamps: true },
);

export const Department = mongoose.model('Department', departmentSchema);
