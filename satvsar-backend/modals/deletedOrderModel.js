// models/deletedOrderModel.js - UNIFIED DELETED ORDER MODEL
const mongoose = require("mongoose");

const DeletedOrderItemSchema = new mongoose.Schema({
    productId: String,
    productName: String,
    batchNumber: String,
    expiryDate: Date,
    quantity: Number,
    price: Number,
    discount: Number,
    taxSlab: Number,
    baseValue: Number,
    discountAmount: Number,
    taxAmount: Number,
    cgstAmount: Number,
    sgstAmount: Number,
    totalAmount: Number,
    
    // For online orders
    colorId: String,
    colorName: String,
    modelId: String,
    modelName: String,
    size: String,
    offerPercentage: Number,
    offerId: mongoose.Schema.Types.ObjectId,
    offerLabel: String,
    savedAmount: Number,
    
    purchasedFromStock: Number,
    inventoryId: String,
    status: String
});

const DeletedOrderSchema = new mongoose.Schema({
    // Original order identification
    originalOrderNumber: {
        type: String,
        required: true,
        index: true
    },
    
    // Order type and source
    orderType: {
        type: String,
        enum: ['online', 'offline'],
        required: true
    },
    businessType: {
        type: String,
        enum: ['b2b', 'b2c'],
        default: 'b2c'
    },
    
    // User/Customer info
    userId: String,
    customer: {
        customerId: String,
        customerNumber: String,
        name: String,
        email: String,
        mobile: String,
        gstNumber: String,
        address: String
    },
    
    // Shipping/Delivery info
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
    shippingDetails: {
        name: String,
        email: String,
        mobile: String,
        gstNumber: String,
        address: String
    },
    
    // Order items
    items: [DeletedOrderItemSchema],
    
    // Pricing
    subtotal: Number,
    baseValue: Number,
    discount: Number,
    promoDiscount: Number,
    appliedPromoCode: {
        promoId: String,
        code: String,
        discount: Number,
        description: String,
        appliedAt: Date
    },
    loyaltyDiscount: Number,
    loyaltyCoinsUsed: Number,
    loyaltyCoinsEarned: Number,
    tax: Number,
    cgst: Number,
    sgst: Number,
    shipping: Number,
    total: Number,
    
    // Payment
    payment: {
        method: String,
        status: String,
        transactionId: String,
        paidAmount: Number,
        paymentDate: Date
    },
    
    // Order info
    checkoutMode: String,
    orderStatus: String,
    remarks: String,
    notes: String,
    
    // Timeline from original order
    timeline: {
        placedAt: Date,
        processedAt: Date,
        shippedAt: Date,
        deliveredAt: Date,
        estimatedDelivery: Date,
        cancelledAt: Date
    },
    
    // Deletion info
    deletedAt: {
        type: Date,
        default: Date.now
    },
    deletedBy: {
        type: String,
        default: "system"
    },
    deletionReason: String,
    
    // Stock restoration info (for offline orders)
    stockRestoration: {
        restored: {
            type: Boolean,
            default: false
        },
        restoredAt: Date,
        itemsStockDetails: [{
            productId: String,
            productName: String,
            batchNumber: String,
            quantityRestored: Number,
            beforeDeletionStock: Number,
            afterRestorationStock: Number
        }]
    },
    
    // Metadata
    originalCreatedAt: Date,
    originalUpdatedAt: Date
}, {
    timestamps: true
});

// Indexes for faster queries
DeletedOrderSchema.index({ originalOrderNumber: 1 });
DeletedOrderSchema.index({ deletedAt: -1 });
DeletedOrderSchema.index({ orderType: 1 });
DeletedOrderSchema.index({ 'customer.mobile': 1 });
DeletedOrderSchema.index({ deletedBy: 1 });

// Static method to archive an order
DeletedOrderSchema.statics.archiveOrder = async function(order, deletedBy = "system", reason = "") {
    try {
        const deletedOrder = new this({
            originalOrderNumber: order.orderNumber,
            orderType: order.orderType,
            businessType: order.businessType,
            userId: order.userId,
            customer: order.customer,
            deliveryAddress: order.deliveryAddress,
            shippingDetails: order.shippingDetails,
            items: order.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate,
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                taxSlab: item.taxSlab,
                baseValue: item.baseValue,
                discountAmount: item.discountAmount,
                taxAmount: item.taxAmount,
                cgstAmount: item.cgstAmount,
                sgstAmount: item.sgstAmount,
                totalAmount: item.totalAmount,
                colorId: item.colorId,
                colorName: item.colorName,
                modelId: item.modelId,
                modelName: item.modelName,
                size: item.size,
                offerPercentage: item.offerPercentage,
                offerId: item.offerId,
                offerLabel: item.offerLabel,
                savedAmount: item.savedAmount,
                purchasedFromStock: item.purchasedFromStock,
                inventoryId: item.inventoryId,
                status: item.status
            })),
            subtotal: order.subtotal,
            baseValue: order.baseValue,
            discount: order.discount,
            promoDiscount: order.promoDiscount,
            appliedPromoCode: order.appliedPromoCode,
            loyaltyDiscount: order.loyaltyDiscount,
            loyaltyCoinsUsed: order.loyaltyCoinsUsed,
            loyaltyCoinsEarned: order.loyaltyCoinsEarned,
            tax: order.tax,
            cgst: order.cgst,
            sgst: order.sgst,
            shipping: order.shipping,
            total: order.total,
            payment: order.payment,
            checkoutMode: order.checkoutMode,
            orderStatus: order.orderStatus,
            remarks: order.remarks,
            notes: order.notes,
            timeline: order.timeline,
            deletedBy: deletedBy,
            deletionReason: reason,
            originalCreatedAt: order.createdAt,
            originalUpdatedAt: order.updatedAt
        });

        await deletedOrder.save();
        console.log(`✅ Order ${order.orderNumber} archived successfully`);
        
        return deletedOrder;
    } catch (error) {
        console.error(`❌ Error archiving order ${order.orderNumber}:`, error);
        throw error;
    }
};

// Instance method to restore stock
DeletedOrderSchema.methods.restoreStock = async function() {
    try {
        const stockRestorationDetails = [];
        
        for (const item of this.items) {
            // Find inventory
            const inventoryItem = await mongoose.model('Inventory').findOne({ 
                productId: item.productId 
            });
            
            if (inventoryItem) {
                // Find batch
                const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);
                
                if (batch) {
                    // Record before restoration
                    const beforeStock = batch.quantity;
                    
                    // Restore quantity
                    batch.quantity += item.quantity;
                    const afterStock = batch.quantity;
                    
                    await inventoryItem.save();
                    
                    stockRestorationDetails.push({
                        productId: item.productId,
                        productName: item.productName,
                        batchNumber: item.batchNumber,
                        quantityRestored: item.quantity,
                        beforeDeletionStock: beforeStock,
                        afterRestorationStock: afterStock
                    });
                }
            }
        }
        
        // Update restoration details
        this.stockRestoration = {
            restored: true,
            restoredAt: new Date(),
            itemsStockDetails: stockRestorationDetails
        };
        
        await this.save();
        
        console.log(`✅ Stock restored for deleted order ${this.originalOrderNumber}`);
        return stockRestorationDetails;
        
    } catch (error) {
        console.error(`❌ Error restoring stock for order ${this.originalOrderNumber}:`, error);
        throw error;
    }
};

// Virtual for easy access
DeletedOrderSchema.virtual('totalItems').get(function() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

DeletedOrderSchema.virtual('customerName').get(function() {
    if (this.orderType === 'online' && this.deliveryAddress) {
        return this.deliveryAddress.fullName;
    } else if (this.orderType === 'offline' && this.customer) {
        return this.customer.name;
    }
    return 'Unknown Customer';
});

module.exports = mongoose.model("DeletedOrder", DeletedOrderSchema);