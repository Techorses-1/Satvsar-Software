// models/Order.js - UNIFIED ORDER SCHEMA
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
    // ========== PRODUCT IDENTIFICATION ==========
    productId: {
        type: String,
        required: true,
        index: true
    },
    productName: {
        type: String,
        required: true
    },
    barcode: String,
    hsn: String,
    category: String,

    // ========== VARIATIONS (FOR E-COMMERCE) ==========
    colorId: {
        type: String,
        default: ""
    },
    colorName: {
        type: String,
        default: ""
    },
    modelId: {
        type: String,
        default: ""
    },
    modelName: {
        type: String,
        default: "Default"
    },
    size: {
        type: String,
        default: ""
    },

    thumbnailImage: {
        type: String,
        default: ""
    },
    // ========== BATCH INFORMATION (FOR BOTH) ==========
    batchNumber: {
        type: String,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },

    // ========== PRICING & QUANTITY ==========
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {               // Base price per unit (MRP)
        type: Number,
        required: true,
        min: 0
    },

    // ========== DISCOUNTS & OFFERS (BOTH SYSTEMS) ==========
    // Product-specific offer (E-commerce style)
    offerPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOffer',
        default: null
    },
    offerLabel: {
        type: String,
        default: ""
    },

    // Item-level discount (Billing style)
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    // ========== TAX INFORMATION (GST) ==========
    taxSlab: {
        type: Number,
        required: true,
        default: 18
    },

    // ========== CALCULATED FIELDS ==========
    baseValue: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    cgstAmount: {
        type: Number,
        default: 0
    },
    sgstAmount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },

    // ========== SAVINGS CALCULATION ==========
    savedAmount: {
        type: Number,
        default: 0
    },

    // ========== INVENTORY SNAPSHOT ==========
    purchasedFromStock: {
        type: Number,
        required: true
    },
    inventoryId: {
        type: String,
        required: true
    },

    // ========== STATUS ==========
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'pending'
    },

    // ========== TIMESTAMPS ==========
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const OrderSchema = new mongoose.Schema({
    // ========== ORDER IDENTIFICATION ==========
    orderNumber: {          // Sequential: INV20250001, INV20250002, etc.
        type: String,
        required: true,
        unique: true,
        index: true
    },


    date: {                 // Invoice date (can be back-dated)
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    // ========== ORDER SOURCE & TYPE ==========
    orderType: {            // Source of order
        type: String,
        enum: ['online', 'offline'],
        required: true,
        index: true
    },
    businessType: {         // For billing/offline orders
        type: String,
        enum: ['b2b', 'b2c'],
        default: 'b2c'
    },

    // ========== USER/CUSTOMER INFORMATION ==========
    userId: {               // For online users (optional for offline)
        type: String,
        index: true
    },
    customer: {             // For offline/store customers
        customerId: String,
        customerNumber: String,
        name: String,
        email: String,
        mobile: String,
        gstNumber: String,
        address: String
    },

    // ========== SHIPPING/DELIVERY INFORMATION ==========
    // For Online orders (E-commerce style)
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
        isDefault: Boolean
    },

    // For Offline orders (Billing style)
    shippingDetails: {
        name: String,
        email: String,
        mobile: String,
        gstNumber: String,
        address: String
    },

    // ========== ORDER ITEMS ==========
    items: [OrderItemSchema],

    // ========== CHECKOUT MODE (ONLINE) ==========
    checkoutMode: {
        type: String,
        enum: ['cart', 'buy-now'],
        default: 'cart'
    },

    // ========== PRICING SUMMARY ==========
    subtotal: {
        type: Number,
        required: true,
        default: 0
    },
    baseValue: {
        type: Number,
        default: 0
    },

    // ========== DISCOUNTS (MULTIPLE TYPES) ==========
    discount: {             // Item-level discounts total
        type: Number,
        default: 0
    },
    promoDiscount: {        // Promo code discount (Billing style)
        type: Number,
        default: 0
    },
    appliedPromoCode: {     // Promo code details
        promoId: String,
        code: String,
        discount: Number,
        description: String,
        appliedAt: Date
    },
    loyaltyDiscount: {      // Loyalty points discount
        type: Number,
        default: 0
    },
    loyaltyCoinsUsed: {     // Loyalty coins used
        type: Number,
        default: 0
    },
    totalSavings: {         // Total savings from all sources (E-commerce)
        type: Number,
        default: 0
    },

    // ========== TAX CALCULATION ==========
    tax: {
        type: Number,
        default: 0
    },
    cgst: {
        type: Number,
        default: 0
    },
    sgst: {
        type: Number,
        default: 0
    },
    taxPercentage: {        // For simple tax calculation (E-commerce)
        type: Number,
        default: 18
    },
    hasMixedTaxRates: {     // For orders with multiple tax slabs
        type: Boolean,
        default: false
    },
    taxPercentages: [Number],

    // ========== SHIPPING & OTHER CHARGES ==========
    shipping: {             // Shipping charges (Online)
        type: Number,
        default: 0
    },

    // ========== FINAL TOTALS ==========
    total: {
        type: Number,
        required: true,
        default: 0
    },

    // ========== PAYMENT INFORMATION ==========
    payment: {
        method: {
            type: String,
            enum: ['cash', 'card', 'upi', 'cod'],
            default: 'cash'
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paidAmount: Number,
        paymentDate: Date
    },

    // ========== ORDER TIMELINE ==========
    timeline: {
        placedAt: {
            type: Date,
            default: Date.now
        },
        processedAt: Date,
        shippedAt: Date,
        deliveredAt: Date,
        estimatedDelivery: Date,
        cancelledAt: Date
    },

    // ========== STATUS ==========
    orderStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'pending',
        index: true
    },

    // ========== LOYALTY POINTS ==========
    loyaltyCoinsEarned: {
        type: Number,
        default: 0
    },

    // ========== ADDITIONAL INFORMATION ==========
    remarks: String,
    notes: String,

    // ========== SYSTEM FIELDS ==========
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },

    // ========== AUDIT FIELDS ==========
    createdBy: {
        type: String,
        default: "system"
    },
    updatedBy: {
        type: String,
        default: "system"
    }
}, {
    timestamps: true
});

// ========== INDEXES ==========
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ 'customer.mobile': 1 });
OrderSchema.index({ 'items.productId': 1 });
OrderSchema.index({ 'items.batchNumber': 1 });
OrderSchema.index({ orderStatus: 1, orderType: 1 });

// ========== VIRTUAL FIELDS ==========
OrderSchema.virtual('totalItems').get(function () {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

OrderSchema.virtual('customerName').get(function () {
    if (this.orderType === 'online' && this.deliveryAddress) {
        return this.deliveryAddress.fullName;
    } else if (this.orderType === 'offline' && this.customer) {
        return this.customer.name;
    }
    return 'Unknown Customer';
});

OrderSchema.virtual('customerMobile').get(function () {
    if (this.orderType === 'online' && this.deliveryAddress) {
        return this.deliveryAddress.mobile;
    } else if (this.orderType === 'offline' && this.customer) {
        return this.customer.mobile;
    }
    return '';
});

// ========== PRE-SAVE HOOKS ==========
OrderSchema.pre("save", function (next) {
    this.updatedAt = new Date();

    // Auto-calculate some fields if not set
    if (!this.orderNumber && this.orderType === 'online') {
        // Will be set by route handler with GlobalCounter
    }

    // Set estimated delivery for online orders
    if (this.orderType === 'online' && !this.timeline.estimatedDelivery) {
        const estDate = new Date();
        estDate.setDate(estDate.getDate() + 5); // 5 days from order
        this.timeline.estimatedDelivery = estDate;
    }

    // Auto-update payment status for COD online orders
    if (this.orderType === 'online' &&
        this.payment.method === 'cod' &&
        this.payment.status === 'pending' &&
        this.orderStatus === 'delivered') {
        this.payment.status = 'paid';
        this.payment.paymentDate = new Date();
        this.payment.paidAmount = this.total;
    }

    // Auto-update payment status for offline cash orders
    if (this.orderType === 'offline' &&
        this.payment.method === 'cash' &&
        this.payment.status === 'pending') {
        this.payment.status = 'paid';
        this.payment.paymentDate = new Date();
        this.payment.paidAmount = this.total;
    }

    if (typeof next === 'function') {
        next();
    }
});

// ========== STATIC METHODS ==========
OrderSchema.statics.generateOrderNumber = async function () {
    const GlobalCounter = mongoose.model('GlobalCounter');
    const counterId = "orders";

    const counter = await GlobalCounter.findOneAndUpdate(
        { id: counterId },
        { $inc: { count: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return `INV${new Date().getFullYear()}${String(counter.count).padStart(5, "0")}`;
};

// ========== INSTANCE METHODS ==========
OrderSchema.methods.calculateTotals = function () {
    let subtotal = 0;
    let totalSavings = 0;
    let totalDiscount = 0;
    let baseValue = 0;
    let tax = 0;
    let cgst = 0;
    let sgst = 0;

    // Recalculate all item totals
    this.items.forEach(item => {
        const itemTotalBeforeDiscount = item.price * item.quantity;
        const itemDiscount = itemTotalBeforeDiscount * (item.discount / 100);
        const itemTotalAfterDiscount = itemTotalBeforeDiscount - itemDiscount;

        subtotal += itemTotalBeforeDiscount;
        totalDiscount += itemDiscount;
        totalSavings += item.savedAmount || 0;

        // GST Calculation
        const itemBaseValue = itemTotalAfterDiscount / (1 + item.taxSlab / 100);
        const itemTax = itemTotalAfterDiscount - itemBaseValue;

        baseValue += itemBaseValue;
        tax += itemTax;
        cgst += itemTax / 2;
        sgst += itemTax / 2;

        // Update item calculated fields
        item.baseValue = parseFloat(itemBaseValue.toFixed(2));
        item.discountAmount = parseFloat(itemDiscount.toFixed(2));
        item.taxAmount = parseFloat(itemTax.toFixed(2));
        item.cgstAmount = parseFloat((itemTax / 2).toFixed(2));
        item.sgstAmount = parseFloat((itemTax / 2).toFixed(2));
        item.totalAmount = parseFloat(itemTotalAfterDiscount.toFixed(2));
    });

    // Apply promo discount
    let finalTotal = subtotal - totalDiscount;
    if (this.promoDiscount && this.promoDiscount > 0) {
        finalTotal -= this.promoDiscount;
    }

    // Apply loyalty discount
    if (this.loyaltyDiscount && this.loyaltyDiscount > 0) {
        finalTotal -= this.loyaltyDiscount;
    }

    // Add shipping for online orders
    if (this.orderType === 'online') {
        finalTotal += this.shipping || 0;
    }

    // Update order totals
    this.subtotal = parseFloat(subtotal.toFixed(2));
    this.discount = parseFloat(totalDiscount.toFixed(2));
    this.totalSavings = parseFloat(totalSavings.toFixed(2));
    this.baseValue = parseFloat(baseValue.toFixed(2));
    this.tax = parseFloat(tax.toFixed(2));
    this.cgst = parseFloat(cgst.toFixed(2));
    this.sgst = parseFloat(sgst.toFixed(2));
    this.total = parseFloat(finalTotal.toFixed(2));

    // Calculate loyalty coins (1 coin per 100 rupees base value)
    this.loyaltyCoinsEarned = Math.floor(this.baseValue / 100);

    return this;
};

OrderSchema.methods.getSummary = function () {
    return {
        orderNumber: this.orderNumber,
        orderType: this.orderType,
        customerName: this.customerName,
        customerMobile: this.customerMobile,
        totalItems: this.totalItems,
        subtotal: this.subtotal,
        total: this.total,
        orderStatus: this.orderStatus,
        paymentStatus: this.payment.status,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model("Order", OrderSchema);
