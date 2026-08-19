const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

// Stock History Schema (Common for both types)
const StockHistorySchema = new mongoose.Schema({
  historyId: {
    type: String,
    default: () => uuidv4(),
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  type: {
    type: String,
    enum: ["added", "deducted", "adjusted", "initial", "sold", "returned", "expired", "disposed" , "restored"],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  batchNumber: {
    type: String,
    default: ""
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
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
    default: "admin"
  }
}, { _id: true });

// Batch Schema (For batch mode only)
// ✅ CHANGE: Removed sellingPrice — only purchase price (price) is tracked here
const BatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    default: () => uuidv4(),
  },
  batchNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  currentQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  manufactureDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  price: {  // Purchase price only
    type: Number,
    required: true,
    min: 0.01
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["active", "expired", "sold-out", "disposed"],
    default: "active"
  }
}, { _id: true });

// Main Inventory Schema
const InventorySchema = new mongoose.Schema({
  inventoryId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  productId: {
    type: String,
    required: true,
    index: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },

  // ===== INVENTORY TYPE =====
  inventoryType: {
    type: String,
    enum: ["simple", "batch"],
    default: "simple",
    required: true
  },

  // ===== FOR SIMPLE PRODUCTS (Clothing/Electronics) =====
  modelName: {
    type: String,
    default: "Default",
  },
  variableModelName: {
    type: String,
  },
  variableModelId: {
    type: String,
  },
  colorId: {
    type: String,
  },
  colorName: {
    type: String,
  },

  // ===== FOR BATCH PRODUCTS =====
  batches: {
    type: [BatchSchema],
    default: []
  },

  // ===== COMMON FIELDS =====

  stock: {
    type: Number,
    default: 0,
    min: 0,
  },

  // ✅ CHANGE: sellingPrice kept on main schema only — used by simple products
  // For batch products, selling price is managed at the product/billing level
  sellingPrice: {
    type: Number,
    min: 0.01
  },

  threshold: {
    type: Number,
    default: 10,
    min: 0,
  },

  stockHistory: {
    type: [StockHistorySchema],
    default: []
  },

  category: {
    type: String,
    default: "General"
  },

  hsnCode: {
    type: String,
    default: ""
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // ✅ CHANGE: totalValue now calculated using batch purchase price * stock for batch type
  totalValue: {
    type: Number,
    default: 0
  }
});

// ===== INDEXES =====
InventorySchema.index({ productId: 1 });
InventorySchema.index({ inventoryType: 1 });
InventorySchema.index({ "batches.expiryDate": 1 });
InventorySchema.index({ stock: 1 });
InventorySchema.index({
  productId: 1,
  variableModelId: 1,
  colorId: 1
}, {
  unique: true,
  sparse: true,
  partialFilterExpression: {
    inventoryType: "simple",
    variableModelId: { $exists: true },
    colorId: { $exists: true }
  }
});

// ===== PRE-SAVE MIDDLEWARE =====
InventorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  if (this.inventoryType === "batch") {
    // Stock = sum of active batch currentQuantity
    this.stock = this.batches
      .filter(batch => batch.status === "active")
      .reduce((total, batch) => total + batch.currentQuantity, 0);

    // ✅ CHANGE: totalValue = sum of (price * currentQuantity) across active batches
    this.totalValue = this.batches
      .filter(batch => batch.status === "active")
      .reduce((total, batch) => total + (batch.price * batch.currentQuantity), 0);

  } else {
    // Simple product: use sellingPrice as before
    if (this.sellingPrice && this.stock) {
      this.totalValue = this.sellingPrice * this.stock;
    }
  }

  if (typeof next === 'function') {
    next();
  }
});

// ===== METHODS FOR SIMPLE PRODUCTS =====

InventorySchema.methods.addStock = function (quantity, reason = "", notes = "", addedBy = "admin") {
  if (this.inventoryType !== "simple") {
    throw new Error("This method is only for simple inventory type");
  }
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const previousStock = this.stock;
  const newStock = previousStock + quantity;

  this.stockHistory.push({
    type: "added",
    quantity: quantity,
    previousStock: previousStock,
    newStock: newStock,
    reason: reason,
    notes: notes,
    addedBy: addedBy
  });

  this.stock = newStock;
  return this;
};

InventorySchema.methods.deductStock = function (quantity, reason = "", notes = "", addedBy = "admin") {
  if (this.inventoryType !== "simple") {
    throw new Error("This method is only for simple inventory type");
  }
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }
  if (this.stock < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.stock}, Requested: ${quantity}`);
  }

  const previousStock = this.stock;
  const newStock = previousStock - quantity;

  this.stockHistory.push({
    type: "deducted",
    quantity: quantity,
    previousStock: previousStock,
    newStock: newStock,
    reason: reason,
    notes: notes,
    addedBy: addedBy
  });

  this.stock = newStock;
  return this;
};

// ===== METHODS FOR BATCH PRODUCTS =====

InventorySchema.methods.addBatch = function (batchData, reason = "", notes = "", addedBy = "admin") {
  if (this.inventoryType !== "batch") {
    throw new Error("This method is only for batch inventory type");
  }

  // ✅ CHANGE: Destructure without sellingPrice
  const { batchNumber, quantity, manufactureDate, expiryDate, price } = batchData;

  const newManuDate = new Date(manufactureDate);
  const newManuYearMonth = `${newManuDate.getFullYear()}-${String(newManuDate.getMonth() + 1).padStart(2, '0')}`;

  const existingBatch = this.batches.find(b =>
    b.batchNumber === batchNumber.trim().toUpperCase()
  );

  if (existingBatch) {
    const existingManuDate = new Date(existingBatch.manufactureDate);
    const existingManuYearMonth = `${existingManuDate.getFullYear()}-${String(existingManuDate.getMonth() + 1).padStart(2, '0')}`;

    if (newManuYearMonth !== existingManuYearMonth) {
      throw new Error(`Batch ${batchNumber} already exists with different manufacture date. Existing: ${existingManuYearMonth}, New: ${newManuYearMonth}`);
    }

    // Same batch + same manufacture month → update quantity
    existingBatch.quantity += quantity;
    existingBatch.currentQuantity += quantity;

    this.stockHistory.push({
      type: "added",
      quantity: quantity,
      batchNumber: batchNumber,
      previousStock: this.stock,
      newStock: this.stock + quantity,
      reason: `Batch quantity updated: ${reason}`,
      notes: notes,
      addedBy: addedBy
    });

  } else {
    // New batch
    const newBatch = {
      batchId: uuidv4(),
      batchNumber: batchNumber.trim().toUpperCase(),
      quantity: quantity,
      currentQuantity: quantity,
      manufactureDate: newManuDate,
      expiryDate: expiryDate,
      price: price,  // ✅ Only purchase price stored
      addedAt: new Date(),
      status: "active"
    };

    this.batches.push(newBatch);

    this.stockHistory.push({
      type: "added",
      quantity: quantity,
      batchNumber: batchNumber,
      previousStock: this.stock,
      newStock: this.stock + quantity,
      reason: `New batch added: ${reason}`,
      notes: notes,
      addedBy: addedBy
    });
  }

  // ✅ CHANGE: No longer updating sellingPrice from batch
  return this;
};

// Deduct stock FIFO
InventorySchema.methods.deductBatchStock = function (quantity, reason = "", notes = "", addedBy = "admin") {
  if (this.inventoryType !== "batch") {
    throw new Error("This method is only for batch inventory type");
  }
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }
  if (this.stock < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.stock}, Requested: ${quantity}`);
  }

  const previousStock = this.stock;
  let remainingToDeduct = quantity;
  const deductedBatches = [];

  const activeBatches = this.batches
    .filter(batch => batch.status === "active" && batch.currentQuantity > 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  for (const batch of activeBatches) {
    if (remainingToDeduct <= 0) break;

    const deductFromBatch = Math.min(batch.currentQuantity, remainingToDeduct);
    batch.currentQuantity -= deductFromBatch;

    if (batch.currentQuantity === 0) {
      batch.status = "sold-out";
    }

    deductedBatches.push({
      batchNumber: batch.batchNumber,
      quantity: deductFromBatch
    });

    remainingToDeduct -= deductFromBatch;
  }

  if (remainingToDeduct > 0) {
    throw new Error(`Could not deduct full quantity. Something went wrong.`);
  }

  const newStock = previousStock - quantity;

  this.stockHistory.push({
    type: "deducted",
    quantity: quantity,
    batchNumber: deductedBatches.map(b => b.batchNumber).join(", "),
    previousStock: previousStock,
    newStock: newStock,
    reason: reason,
    notes: `${notes} | Batches: ${deductedBatches.map(b => `${b.batchNumber}(${b.quantity})`).join(", ")}`,
    addedBy: addedBy
  });

  return this;
};

// Check for expired batches
InventorySchema.methods.checkExpiry = function () {
  if (this.inventoryType !== "batch") {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredBatches = this.batches.filter(batch => {
    if (batch.status !== "active") return false;
    const expiryDate = new Date(batch.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);
    return expiryDate < today;
  });

  return expiredBatches;
};

// Get batch summary
InventorySchema.methods.getBatchSummary = function () {
  if (this.inventoryType !== "batch") {
    return null;
  }

  const activeBatches = this.batches.filter(batch => batch.status === "active");
  const expiredBatches = this.batches.filter(batch => batch.status === "expired");
  const soldOutBatches = this.batches.filter(batch => batch.status === "sold-out");

  return {
    totalBatches: this.batches.length,
    activeBatches: activeBatches.length,
    expiredBatches: expiredBatches.length,
    soldOutBatches: soldOutBatches.length,
    totalStock: this.stock,
    nextExpiry: activeBatches.length > 0
      ? new Date(Math.min(...activeBatches.map(b => new Date(b.expiryDate))))
      : null,
    totalValue: this.totalValue || 0
  };
};

module.exports = mongoose.model("Inventory", InventorySchema);