// models/CancelledOrder.js
const mongoose = require("mongoose");

// ============================================================
// CANCELLED ORDER — archive of cancelled/deleted orders
// Mirrors Order schema + cancel metadata
// Same idea as POS's CancelledInvoice collection
// ============================================================

// -------- Copy of OrderItemSchema (identical to Order) --------
const CancelledOrderItemSchema = new mongoose.Schema(
    {
        productId: { type: String, required: true, index: true },
        productName: { type: String, required: true },
        barcode: String,
        hsn: String,
        category: String,

        colorId: { type: String, default: "" },
        colorName: { type: String, default: "" },
        modelId: { type: String, default: "" },
        modelName: { type: String, default: "Default" },
        size: { type: String, default: "" },
        thumbnailImage: { type: String, default: "" },

        batchNumber: { type: String, required: true },
        expiryDate: { type: Date, required: true },

        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },

        offerPercentage: { type: Number, default: 0, min: 0, max: 100 },
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductOffer",
            default: null,
        },
        offerLabel: { type: String, default: "" },
        discount: { type: Number, default: 0, min: 0, max: 100 },

        taxSlab: { type: Number, required: true, default: 18 },

        baseValue: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        cgstAmount: { type: Number, default: 0 },
        sgstAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },

        savedAmount: { type: Number, default: 0 },

        purchasedFromStock: { type: Number, required: true },
        inventoryId: { type: String, required: true },

        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
                "returned",
            ],
            default: "pending",
        },

        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

// -------- Main Cancelled Order Schema --------
const CancelledOrderSchema = new mongoose.Schema(
    {
        // ============ ORIGINAL ORDER FIELDS (SNAPSHOT) ============
        originalOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        orderNumber: {
            type: String,
            required: true,
            index: true,
        },
        date: { type: Date, required: true, index: true },

        orderType: {
            type: String,
            enum: ["online", "offline"],
            required: true,
            index: true,
        },
        businessType: {
            type: String,
            enum: ["b2b", "b2c"],
            default: "b2c",
        },

        userId: { type: String, index: true },
        customer: {
            customerId: String,
            customerNumber: String,
            name: String,
            email: String,
            mobile: String,
            gstNumber: String,
            address: String,
        },

        deliveryAddress: {
            addressId: String,
            fullName: String,
            mobile: String,
            email: String,
            addressLine1: String,
            addressLine2: String,
            landmark: String,
            city: String,
            state: String,
            pincode: String,
            country: String,
            addressType: String,
            instructions: String,
            isDefault: Boolean,
        },

        shippingDetails: {
            name: String,
            email: String,
            mobile: String,
            gstNumber: String,
            address: String,
        },

        items: [CancelledOrderItemSchema],

        checkoutMode: {
            type: String,
            enum: ["cart", "buy-now"],
            default: "cart",
        },

        // ============ TOTALS SNAPSHOT ============
        subtotal: { type: Number, required: true, default: 0 },
        baseValue: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        promoDiscount: { type: Number, default: 0 },
        appliedPromoCode: {
            promoId: String,
            code: String,
            discount: Number,
            description: String,
            appliedAt: Date,
        },
        loyaltyDiscount: { type: Number, default: 0 },
        loyaltyCoinsUsed: { type: Number, default: 0 },
        totalSavings: { type: Number, default: 0 },

        tax: { type: Number, default: 0 },
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        taxPercentage: { type: Number, default: 18 },
        hasMixedTaxRates: { type: Boolean, default: false },
        taxPercentages: [Number],

        shipping: { type: Number, default: 0 },
        total: { type: Number, required: true, default: 0 },

        payment: {
            method: {
                type: String,
                enum: ["cash", "card", "upi", "cod"],
                default: "cash",
            },
            status: {
                type: String,
                enum: ["pending", "paid", "failed", "refunded"],
                default: "pending",
            },
            transactionId: String,
            paidAmount: Number,
            paymentDate: Date,
        },

        timeline: {
            placedAt: Date,
            processedAt: Date,
            shippedAt: Date,
            deliveredAt: Date,
            estimatedDelivery: Date,
            cancelledAt: Date,
        },

        orderStatus: {
            type: String,
            enum: [
                "pending",
                "confirmed",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
                "returned",
            ],
            default: "cancelled",
        },

        loyaltyCoinsEarned: { type: Number, default: 0 },

        remarks: String,
        notes: String,

        createdBy: { type: String, default: "system" },
        updatedBy: { type: String, default: "system" },

        // ============ CANCEL-SPECIFIC FIELDS ============
        cancelledBy: {
            userId: { type: String, default: "" },
            name: { type: String, default: "" },
            email: { type: String, default: "" },
        },
        cancelledAt: { type: Date, default: () => new Date() },
        cancelReason: { type: String, default: "" },

        // What was the source of the cancellation action
        cancelSource: {
            type: String,
            enum: ["status-route", "cancel-route", "delete-route", "admin"],
            default: "cancel-route",
        },
    },
    { timestamps: true }
);

// ============ INDEXES ============
CancelledOrderSchema.index({ orderNumber: 1 });
CancelledOrderSchema.index({ originalOrderId: 1 });
CancelledOrderSchema.index({ cancelledAt: -1 });
CancelledOrderSchema.index({ orderType: 1 });
CancelledOrderSchema.index({ "customer.mobile": 1 });

const CancelledOrder =
    mongoose.models.CancelledOrder ||
    mongoose.model("CancelledOrder", CancelledOrderSchema);

module.exports = CancelledOrder;