// models/ActiveInvoiceNumber.js
const mongoose = require("mongoose");

// ============================================================
// ACTIVE INVOICE NUMBER REGISTRY
// Shared across POS + E-com (both connect to same `pos` DB)
//
// Purpose:
//   - Tracks only currently ACTIVE invoice numbers (both projects)
//   - On create → insert new number
//   - On cancel → delete number (frees it for reuse)
//   - Next number = max(num for current year) + 1
// ============================================================

const activeInvoiceNumberSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        year: {
            type: Number,
            required: true,
            index: true,
        },
        num: {
            type: Number,
            required: true,
            index: true,
        },
        project: {
            type: String,
            enum: ["pos", "ecom"],
            default: "pos",
        },
        createdAt: {
            type: Date,
            default: () => new Date(),
        },
    },
    {
        timestamps: false,
        _id: false,
    }
);

activeInvoiceNumberSchema.index({ year: 1, num: -1 });

const ActiveInvoiceNumber =
    mongoose.models.ActiveInvoiceNumber ||
    mongoose.model("ActiveInvoiceNumber", activeInvoiceNumberSchema);

module.exports = ActiveInvoiceNumber;