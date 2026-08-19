// models/Distributor.js
const mongoose = require("mongoose");

const DistributorSchema = new mongoose.Schema({
    distributorId: {
        type: String,
        required: true,
        unique: true,
        default: () => `DIST${Date.now()}${Math.floor(Math.random() * 1000)}`
    },

    // Distributor Information
    fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        match: /^[0-9]{10}$/
    },
    city: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },
    message: {
        type: String,
        trim: true,
        default: ''
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'contacted', 'approved', 'rejected'],
        default: 'pending'
    },
    isContacted: {
        type: Boolean,
        default: false
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for rate limiting
DistributorSchema.index({ email: 1, createdAt: -1 });
DistributorSchema.index({ phone: 1, createdAt: -1 });

// Pre-save hook
DistributorSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    if (typeof next === 'function') {
        next();
    }
});

module.exports = mongoose.model("Distributor", DistributorSchema);