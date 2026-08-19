// models/Contact.js - FIXED
const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
    contactId: {
        type: String,
        required: true,
        unique: true,
        default: () => `CONT${Date.now()}${Math.floor(Math.random() * 1000)}`
    },

    // User Information
    name: {
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
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 10
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'read', 'replied', 'spam'],
        default: 'pending'
    },
    isReplied: {
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
ContactSchema.index({ email: 1, createdAt: -1 });

// Pre-save hook - FIXED
ContactSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    if (typeof next === 'function') {
        next();
    }
});

// If you're using Mongoose 6+, you can also use this simpler version:
// ContactSchema.pre("save", function() {
//     this.updatedAt = new Date();
// });

module.exports = mongoose.model("Contact", ContactSchema);