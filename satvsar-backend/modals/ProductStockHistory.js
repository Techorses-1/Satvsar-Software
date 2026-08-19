// FILE: modals/ProductStockHistory.js

const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

// Stock movement schema for individual batch
const StockMovementSchema = new mongoose.Schema({
    movementId: {
        type: String,
        default: () => uuidv4(),
    },
    type: {
        type: String,
        enum: ["deducted", "restored", "sold", "added"],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    orderNumber: {
        type: String,
        default: ""
    },
    orderType: {
        type: String,
        enum: ["online", "offline", ""],
        default: ""
    },
    reason: {
        type: String,
        default: ""
    },
    notes: {
        type: String,
        default: ""
    },
    addedBy: {
        type: String,
        default: "system"
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Batch schema with its own history array
const BatchStockSchema = new mongoose.Schema({
    batchId: {
        type: String,
        default: () => uuidv4(),
    },
    batchNumber: {
        type: String,
        required: true
    },
    currentStock: {
        type: Number,
        default: 0
    },
    history: {
        type: [StockMovementSchema],
        default: []
    }
});

// MAIN PRODUCT SCHEMA - ONE document per product
const ProductStockHistorySchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    productName: {
        type: String,
        required: true
    },
    inventoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    batches: {
        type: [BatchStockSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
ProductStockHistorySchema.index({ productId: 1 });
ProductStockHistorySchema.index({ "batches.batchNumber": 1 });

module.exports = mongoose.model("ProductStockHistory", ProductStockHistorySchema);