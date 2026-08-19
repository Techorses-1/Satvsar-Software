// models/Otp.js
const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['forgot-password', 'email-verification', 'mobile-verification'],
        default: 'forgot-password'
    },
    attempts: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 600 } // Auto-delete after 10 minutes (600 seconds)
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Static method to generate OTP
OtpSchema.statics.generateOTP = function () {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create OTP
OtpSchema.statics.createOTP = async function (email, purpose = 'forgot-password') {
    // Check for existing OTPs and delete expired ones
    await this.deleteMany({
        email,
        purpose,
        expiresAt: { $lt: new Date() }
    });

    // Check rate limiting (max 3 requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await this.countDocuments({
        email,
        purpose,
        createdAt: { $gt: oneHourAgo }
    });

    if (recentRequests >= 3) {
        throw new Error('Too many OTP requests. Please try again after 1 hour.');
    }

    // Check if user requested within last 60 seconds
    const lastRequest = await this.findOne({
        email,
        purpose,
        createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
    });

    if (lastRequest) {
        throw new Error('Please wait 60 seconds before requesting another OTP.');
    }

    // Generate and save OTP
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const otpRecord = await this.create({
        email,
        otp,
        purpose,
        expiresAt
    });

    return { otp, otpRecord };
};

// Static method to verify OTP
OtpSchema.statics.verifyOTP = async function (email, otp, purpose = 'forgot-password') {
    const otpRecord = await this.findOne({
        email,
        otp,
        purpose,
        expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
        // Increment attempts for the latest OTP record
        await this.updateOne(
            { email, purpose, expiresAt: { $gt: new Date() } },
            { $inc: { attempts: 1 } }
        );

        // Check if too many failed attempts
        const failedAttempts = await this.countDocuments({
            email,
            purpose,
            attempts: { $gt: 0 },
            createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) }
        });

        if (failedAttempts >= 3) {
            throw new Error('Too many failed attempts. Please try again after 30 minutes.');
        }

        throw new Error('Invalid or expired OTP');
    }

    // Delete OTP after successful verification
    await this.deleteOne({ _id: otpRecord._id });

    return true;
};

module.exports = mongoose.model("Otp", OtpSchema);