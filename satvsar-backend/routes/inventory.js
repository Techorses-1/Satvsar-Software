const express = require("express");
const router = express.Router();
const Inventory = require("../modals/Inventory");
const Product = require("../modals/Product");
const { adminAuth } = require("../middleware/auth");
const mongoose = require("mongoose");

// ===== HELPER FUNCTIONS =====

// Calculate expiry date (12 months from manufacture)
const calculateExpiryDate = (manufactureDate) => {
  const expiry = new Date(manufactureDate);
  expiry.setMonth(expiry.getMonth() + 12);
  return expiry;
};

// Validate batch data
const validateBatchData = (batchData) => {
  const errors = [];

  if (!batchData.batchNumber || batchData.batchNumber.trim() === "") {
    errors.push("Batch number is required");
  }

  if (!batchData.quantity || isNaN(batchData.quantity) || batchData.quantity <= 0) {
    errors.push("Valid quantity is required");
  }

  if (!batchData.manufactureDate) {
    errors.push("Manufacture date is required");
  }

  if (!batchData.price || isNaN(batchData.price) || batchData.price <= 0) {
    errors.push("Valid price is required");
  }

  return errors;
};

// ===== COMMON ROUTES (For both types) =====

// GET all inventory with details
router.get("/all", async (req, res) => {
  try {
    const { type, category, lowStock, expired } = req.query;

    let query = { isActive: true };

    // Filter by inventory type
    if (type === "simple" || type === "batch") {
      query.inventoryType = type;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter low stock items
    if (lowStock === "true") {
      query.$expr = { $lt: ["$stock", "$threshold"] };
    }

    const inventory = await Inventory.find(query).sort({ updatedAt: -1 });

    // For batch products, check expiry
    if (expired === "true") {
      const today = new Date();
      const expiredInventory = inventory.filter(item => {
        if (item.inventoryType !== "batch") return false;
        return item.batches.some(batch =>
          batch.status === "active" &&
          new Date(batch.expiryDate) < today
        );
      });
      return res.json(expiredInventory);
    }

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET single inventory item
router.get("/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await Inventory.findOne({
      inventoryId,
      isActive: true
    });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching inventory item:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET stock history
router.get("/stock-history/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const inventory = await Inventory.findOne({ inventoryId })
      .select("stockHistory productName inventoryType colorName modelName");

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    // Sort history by date (newest first)
    const sortedHistory = inventory.stockHistory.sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedHistory = sortedHistory.slice(startIndex, endIndex);

    res.json({
      productName: inventory.productName,
      inventoryType: inventory.inventoryType,
      colorName: inventory.colorName,
      modelName: inventory.modelName,
      currentStock: inventory.stock,
      totalHistory: sortedHistory.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(sortedHistory.length / limit),
      history: paginatedHistory
    });
  } catch (err) {
    console.error("Error fetching stock history:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET low stock alerts
router.get("/alerts/low-stock", adminAuth, async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      isActive: true,
      $expr: { $lt: ["$stock", "$threshold"] }
    }).sort({ stock: 1 });

    res.json({
      count: lowStockItems.length,
      items: lowStockItems
    });
  } catch (err) {
    console.error("Error fetching low stock alerts:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE threshold
router.put("/update-threshold/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { threshold } = req.body;

    if (threshold === undefined || isNaN(threshold) || threshold < 0) {
      return res.status(400).json({ error: "Valid threshold is required" });
    }

    const updated = await Inventory.findOneAndUpdate(
      { inventoryId },
      { threshold: parseFloat(threshold), updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json({
      message: "Threshold updated successfully",
      inventory: updated,
    });
  } catch (err) {
    console.error("Error updating threshold:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ROUTES FOR SIMPLE PRODUCTS =====

// CREATE simple inventory (for color/model products)
router.post("/create-simple", adminAuth, async (req, res) => {
  try {
    const {
      productId,
      productName,
      modelName,
      variableModelName,
      variableModelId,
      colorId,
      colorName,
      initialStock,
      sellingPrice,
      category,
      hsnCode,
      threshold
    } = req.body;

    // Validation
    if (!productId || !productName) {
      return res.status(400).json({ error: "Product ID and Name are required" });
    }

    if (initialStock !== undefined && (isNaN(initialStock) || initialStock < 0)) {
      return res.status(400).json({ error: "Valid initial stock is required" });
    }

    // Check if inventory already exists for this combination
    const existing = await Inventory.findOne({
      productId,
      variableModelId: variableModelId || null,
      colorId: colorId || null,
      inventoryType: "simple",
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        error: "Inventory already exists for this product variant",
        existingItem: existing
      });
    }

    // Create new inventory
    const inventory = new Inventory({
      inventoryType: "simple",
      productId,
      productName,
      modelName: modelName || "Default",
      variableModelName,
      variableModelId,
      colorId,
      colorName,
      stock: initialStock || 0,
      sellingPrice: sellingPrice || 0,
      category: category || "General",
      hsnCode: hsnCode || "",
      threshold: threshold || 10,
      isActive: true
    });

    // Add initial stock history if stock > 0
    if (initialStock > 0) {
      inventory.stockHistory.push({
        type: "initial",
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        reason: "Initial stock setup",
        addedBy: req.admin?.email || "admin"
      });
    }

    await inventory.save();

    res.status(201).json({
      message: "Simple inventory created successfully",
      inventory
    });
  } catch (err) {
    console.error("Error creating simple inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// ADD stock to simple inventory
router.put("/simple/add-stock/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, reason, notes } = req.body;

    // Validate
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "simple") {
      return res.status(400).json({ error: "This inventory item is not a simple type" });
    }

    // Add stock using schema method
    inventory.addStock(
      parseFloat(quantity),
      reason || "Stock added manually",
      notes || "",
      req.admin?.email || "admin"
    );

    await inventory.save();

    res.json({
      message: `Successfully added ${quantity} stock`,
      inventory: {
        inventoryId: inventory.inventoryId,
        productName: inventory.productName,
        colorName: inventory.colorName,
        previousStock: inventory.stockHistory[inventory.stockHistory.length - 2]?.newStock || 0,
        newStock: inventory.stock,
        addedQuantity: quantity
      }
    });
  } catch (err) {
    console.error("Error adding stock to simple inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// DEDUCT stock from simple inventory
router.put("/simple/deduct-stock/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, reason, notes } = req.body;

    // Validate
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "simple") {
      return res.status(400).json({ error: "This inventory item is not a simple type" });
    }

    // Check stock availability
    if (inventory.stock < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${inventory.stock}, Requested: ${quantity}`
      });
    }

    // Deduct stock using schema method
    inventory.deductStock(
      parseFloat(quantity),
      reason || "Stock deducted manually",
      notes || "",
      req.admin?.email || "admin"
    );

    await inventory.save();

    res.json({
      message: `Successfully deducted ${quantity} stock`,
      inventory: {
        inventoryId: inventory.inventoryId,
        productName: inventory.productName,
        colorName: inventory.colorName,
        previousStock: inventory.stockHistory[inventory.stockHistory.length - 2]?.newStock || 0,
        newStock: inventory.stock,
        deductedQuantity: quantity
      }
    });
  } catch (err) {
    console.error("Error deducting stock from simple inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// SET stock for simple inventory
router.put("/simple/set-stock/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { stock, reason, notes } = req.body;

    // Validate
    if (stock === undefined || isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: "Valid stock value is required" });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "simple") {
      return res.status(400).json({ error: "This inventory item is not a simple type" });
    }

    const previousStock = inventory.stock;
    const difference = stock - previousStock;

    if (difference === 0) {
      return res.json({
        message: "Stock is already at the requested level",
        inventory
      });
    }

    // Update stock and add to history
    const actionType = difference > 0 ? "added" : "deducted";

    inventory.stockHistory.push({
      type: actionType,
      quantity: Math.abs(difference),
      previousStock: previousStock,
      newStock: stock,
      reason: reason || "Stock adjusted manually",
      notes: notes || "",
      addedBy: req.admin?.email || "admin"
    });

    inventory.stock = stock;
    await inventory.save();

    res.json({
      message: `Stock ${actionType === "added" ? "increased by" : "decreased by"} ${Math.abs(difference)} to ${stock}`,
      inventory: {
        inventoryId: inventory.inventoryId,
        productName: inventory.productName,
        colorName: inventory.colorName,
        previousStock,
        newStock: stock,
        change: difference
      }
    });
  } catch (err) {
    console.error("Error setting stock for simple inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ROUTES FOR BATCH PRODUCTS =====

// CREATE batch inventory
router.post("/create-batch", adminAuth, async (req, res) => {
  try {
    const {
      productId,
      productName,
      initialBatch,
      sellingPrice,
      category,
      hsnCode,
      threshold
    } = req.body;

    // Validation
    if (!productId || !productName) {
      return res.status(400).json({ error: "Product ID and Name are required" });
    }

    if (!initialBatch || !Array.isArray(initialBatch) || initialBatch.length === 0) {
      return res.status(400).json({ error: "At least one initial batch is required" });
    }

    // Validate all batches
    const batchErrors = [];
    initialBatch.forEach((batch, index) => {
      const errors = validateBatchData(batch);
      if (errors.length > 0) {
        batchErrors.push({
          batchIndex: index,
          batchNumber: batch.batchNumber || `Batch ${index + 1}`,
          errors
        });
      }
    });

    if (batchErrors.length > 0) {
      return res.status(400).json({
        error: "Batch validation failed",
        batchErrors
      });
    }

    // Check if batch inventory already exists
    const existing = await Inventory.findOne({
      productId,
      inventoryType: "batch",
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        error: "Batch inventory already exists for this product",
        existingItem: existing
      });
    }

    // Create new inventory with batches
    const inventory = new Inventory({
      inventoryType: "batch",
      productId,
      productName,
      stock: 0, // Will be calculated from batches
      sellingPrice: sellingPrice || initialBatch[0].sellingPrice || initialBatch[0].price,
      category: category || "General",
      hsnCode: hsnCode || "",
      threshold: threshold || 10,
      batches: [],
      isActive: true
    });

    // Add initial batches
    for (const batch of initialBatch) {
      const expiryDate = calculateExpiryDate(batch.manufactureDate);

      inventory.batches.push({
        batchNumber: batch.batchNumber.trim().toUpperCase(),
        quantity: parseFloat(batch.quantity),
        currentQuantity: parseFloat(batch.quantity),
        manufactureDate: new Date(batch.manufactureDate),
        expiryDate: expiryDate,
        price: parseFloat(batch.price),
        sellingPrice: batch.sellingPrice || parseFloat(batch.price),
        status: "active"
      });

      // Add to stock history
      inventory.stockHistory.push({
        type: "initial",
        quantity: parseFloat(batch.quantity),
        batchNumber: batch.batchNumber,
        previousStock: inventory.stock,
        newStock: inventory.stock + parseFloat(batch.quantity),
        reason: "Initial batch setup",
        notes: `Batch: ${batch.batchNumber}, Manufacture: ${batch.manufactureDate}`,
        addedBy: req.admin?.email || "admin"
      });
    }

    await inventory.save();

    res.status(201).json({
      message: "Batch inventory created successfully",
      inventory,
      batchSummary: inventory.getBatchSummary()
    });
  } catch (err) {
    console.error("Error creating batch inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// ADD batch to existing batch inventory
router.post("/batch/add-batch/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { batch, reason, notes } = req.body;

    // Validate
    if (!batch) {
      return res.status(400).json({ error: "Batch data is required" });
    }

    const errors = validateBatchData(batch);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Batch validation failed", errors });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "batch") {
      return res.status(400).json({ error: "This inventory item is not a batch type" });
    }

    try {
      // Check if batch already exists
      const existingBatch = inventory.batches.find(
        b => b.batchNumber === batch.batchNumber.trim().toUpperCase()
      );

      // If batch exists, update its status back to active if it was sold-out/disposed
      if (existingBatch) {
        if (existingBatch.status === "sold-out" || existingBatch.status === "disposed") {
          existingBatch.status = "active";
        }
      }

      // Add/update batch using schema method
      inventory.addBatch(
        {
          batchNumber: batch.batchNumber.trim().toUpperCase(),
          quantity: parseFloat(batch.quantity),
          manufactureDate: batch.manufactureDate,
          expiryDate: calculateExpiryDate(batch.manufactureDate),
          price: parseFloat(batch.price),
        },
        reason || "Batch added",
        notes || "",
        req.admin?.email || "admin"
      );

      await inventory.save();

      res.json({
        message: "Batch added/updated successfully",
        inventory,
        batchSummary: inventory.getBatchSummary()
      });

    } catch (batchError) {
      return res.status(400).json({
        error: batchError.message,
        details: "Batch validation failed"
      });
    }

  } catch (err) {
    console.error("Error adding batch:", err);
    res.status(500).json({ error: err.message });
  }
});

// DEDUCT stock from batch inventory (FIFO)
router.put("/batch/deduct-stock/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, reason, notes } = req.body;

    // Validate
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "batch") {
      return res.status(400).json({ error: "This inventory item is not a batch type" });
    }

    // Check stock availability
    if (inventory.stock < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${inventory.stock}, Requested: ${quantity}`
      });
    }

    const previousStock = inventory.stock;
    let remainingToDeduct = quantity;
    const deductedBatches = [];

    // Get active batches sorted by expiry date (FIFO - oldest expiry first)
    const activeBatches = inventory.batches
      .filter(batch => batch.status === "active" && batch.currentQuantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    // Deduct from batches
    for (const batch of activeBatches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(batch.currentQuantity, remainingToDeduct);
      batch.currentQuantity -= deductFromBatch;

      if (batch.currentQuantity === 0) {
        batch.status = "sold-out";
      }

      deductedBatches.push({
        batchNumber: batch.batchNumber,
        quantity: deductFromBatch,
        remaining: batch.currentQuantity
      });

      remainingToDeduct -= deductFromBatch;
    }

    // Update stock history
    inventory.stockHistory.push({
      type: "deducted",
      quantity: quantity,
      batchNumber: deductedBatches.map(b => b.batchNumber).join(", "),
      previousStock: previousStock,
      newStock: previousStock - quantity,
      reason: reason || "Stock deducted",
      notes: `${notes || ""} | Batches: ${deductedBatches.map(b => `${b.batchNumber}(${b.quantity})`).join(", ")}`,
      addedBy: req.admin?.email || "admin"
    });

    await inventory.save();

    res.json({
      message: `Successfully deducted ${quantity} stock from batches`,
      inventory: {
        inventoryId: inventory.inventoryId,
        productName: inventory.productName,
        previousStock,
        newStock: inventory.stock,
        deductedBatches,
        batchSummary: inventory.getBatchSummary()
      }
    });
  } catch (err) {
    console.error("Error deducting stock from batch inventory:", err);
    res.status(500).json({ error: err.message });
  }
});

// MARK batch as expired
router.put("/batch/mark-expired/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { batchNumbers, reason, notes } = req.body;

    if (!batchNumbers || !Array.isArray(batchNumbers) || batchNumbers.length === 0) {
      return res.status(400).json({ error: "Batch numbers array is required" });
    }

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "batch") {
      return res.status(400).json({ error: "This inventory item is not a batch type" });
    }

    const expiredBatches = [];
    let totalExpiredQuantity = 0;

    // Mark batches as expired
    for (const batchNumber of batchNumbers) {
      const batch = inventory.batches.find(b =>
        b.batchNumber === batchNumber && b.status === "active"
      );

      if (batch) {
        batch.status = "expired";
        totalExpiredQuantity += batch.currentQuantity;
        expiredBatches.push({
          batchNumber: batch.batchNumber,
          quantity: batch.currentQuantity,
          expiryDate: batch.expiryDate
        });

        // Add to stock history
        inventory.stockHistory.push({
          type: "expired",
          quantity: batch.currentQuantity,
          batchNumber: batch.batchNumber,
          previousStock: inventory.stock,
          newStock: inventory.stock - batch.currentQuantity,
          reason: reason || "Batch expired",
          notes: notes || `Expiry date: ${batch.expiryDate.toISOString().split('T')[0]}`,
          addedBy: req.admin?.email || "admin"
        });
      }
    }

    if (expiredBatches.length === 0) {
      return res.status(400).json({ error: "No active batches found with the provided batch numbers" });
    }

    await inventory.save();

    res.json({
      message: `Marked ${expiredBatches.length} batch(es) as expired`,
      expiredBatches,
      totalExpiredQuantity,
      batchSummary: inventory.getBatchSummary()
    });
  } catch (err) {
    console.error("Error marking batches as expired:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET batch expiry alerts
router.get("/alerts/expiry", adminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query; // Default: 30 days warning

    const today = new Date();
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + parseInt(days));

    // Find all batch inventories
    const batchInventories = await Inventory.find({
      inventoryType: "batch",
      isActive: true,
      "batches.status": "active"
    });

    const expiryAlerts = [];

    for (const inventory of batchInventories) {
      const expiringBatches = inventory.batches.filter(batch => {
        if (batch.status !== "active") return false;

        const expiryDate = new Date(batch.expiryDate);
        return expiryDate <= warningDate && expiryDate >= today;
      });

      if (expiringBatches.length > 0) {
        expiryAlerts.push({
          inventoryId: inventory.inventoryId,
          productId: inventory.productId,
          productName: inventory.productName,
          expiringBatches: expiringBatches.map(batch => ({
            batchNumber: batch.batchNumber,
            currentQuantity: batch.currentQuantity,
            expiryDate: batch.expiryDate,
            daysUntilExpiry: Math.ceil((new Date(batch.expiryDate) - today) / (1000 * 60 * 60 * 24))
          }))
        });
      }
    }

    res.json({
      count: expiryAlerts.length,
      daysWarning: parseInt(days),
      alerts: expiryAlerts
    });
  } catch (err) {
    console.error("Error fetching expiry alerts:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET batch summary for specific inventory
router.get("/batch/summary/:inventoryId", adminAuth, async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await Inventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (inventory.inventoryType !== "batch") {
      return res.status(400).json({ error: "This inventory item is not a batch type" });
    }

    res.json({
      productName: inventory.productName,
      totalStock: inventory.stock,
      totalValue: inventory.totalValue,
      batchSummary: inventory.getBatchSummary(),
      batches: inventory.batches
    });
  } catch (err) {
    console.error("Error fetching batch summary:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== BULK OPERATIONS =====

// BULK add stock to simple inventory items
router.put("/bulk/add-stock-simple", adminAuth, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Updates array is required" });
    }

    const results = [];
    const errors = [];
    const addedBy = req.admin?.email || "admin";

    for (const update of updates) {
      try {
        const { inventoryId, quantity, reason, notes } = update;

        if (!inventoryId || !quantity || quantity <= 0) {
          errors.push({ inventoryId: inventoryId || "unknown", error: "Invalid data" });
          continue;
        }

        const inventory = await Inventory.findOne({ inventoryId });

        if (!inventory) {
          errors.push({ inventoryId, error: "Not found" });
          continue;
        }

        if (inventory.inventoryType !== "simple") {
          errors.push({ inventoryId, error: "Not a simple inventory type" });
          continue;
        }

        inventory.addStock(quantity, reason || "Bulk addition", notes || "", addedBy);
        await inventory.save();

        results.push({
          inventoryId,
          productName: inventory.productName,
          colorName: inventory.colorName,
          addedQuantity: quantity,
          newStock: inventory.stock
        });
      } catch (err) {
        errors.push({ inventoryId: update.inventoryId, error: err.message });
      }
    }

    res.json({
      message: "Bulk stock addition completed",
      results,
      errors,
      successful: results.length,
      failed: errors.length
    });
  } catch (err) {
    console.error("Error in bulk stock addition:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== STATISTICS =====

// GET inventory statistics
router.get("/statistics/summary", adminAuth, async (req, res) => {
  try {
    // Get counts by type
    const simpleCount = await Inventory.countDocuments({
      inventoryType: "simple",
      isActive: true
    });

    const batchCount = await Inventory.countDocuments({
      inventoryType: "batch",
      isActive: true
    });

    // Get low stock counts
    const lowStockCount = await Inventory.countDocuments({
      isActive: true,
      $expr: { $lt: ["$stock", "$threshold"] }
    });

    // Get total inventory value
    const totalValueResult = await Inventory.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalValue: { $sum: "$totalValue" } } }
    ]);

    // Get expiry alert count
    const today = new Date();
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + 30);

    const expiryAlertCount = await Inventory.aggregate([
      { $match: { inventoryType: "batch", isActive: true } },
      { $unwind: "$batches" },
      {
        $match: {
          "batches.status": "active",
          "batches.expiryDate": { $lte: warningDate, $gte: today }
        }
      },
      { $count: "count" }
    ]);

    res.json({
      summary: {
        totalProducts: simpleCount + batchCount,
        simpleProducts: simpleCount,
        batchProducts: batchCount,
        lowStockAlerts: lowStockCount,
        expiryAlerts: expiryAlertCount[0]?.count || 0,
        totalInventoryValue: totalValueResult[0]?.totalValue || 0
      }
    });
  } catch (err) {
    console.error("Error fetching inventory statistics:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;