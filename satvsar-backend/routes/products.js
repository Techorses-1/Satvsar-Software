const express = require("express");
const router = express.Router();
const Product = require("../modals/Product");
const Inventory = require("../modals/Inventory");
const { adminAuth } = require("../middleware/auth");
const upload = require("../middleware/uploadProduct");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseField = (field) => {
  if (field && typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (err) {
      return [];
    }
  }
  return field || [];
};

const createImageUrl = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/products-images/${filename}`;
}

// ─── Image Cleanup Helper ────────────────────────────────────────────────────
// Extract filename from URL and delete from uploads folder
const deleteImageFile = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extract filename from URL (e.g., http://localhost:5000/products/abc123.jpg -> abc123.jpg)
    const urlParts = imageUrl.split('/products-images/');
    if (urlParts.length < 2) return;

    const filename = urlParts[1];
    const filePath = path.join(__dirname, '../products-images', filename);

    // Check if file exists before trying to delete
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ Deleted image: ${filename}`);
    } catch (err) {
      // File doesn't exist - just log
      console.log(`⚠️ Image not found: ${filename}`);
    }
  } catch (err) {
    // Log but don't throw error
    console.log(`⚠️ Could not delete image: ${imageUrl}`, err.message);
  }
};

// Delete all images associated with a product
const deleteProductImages = async (product) => {
  try {
    const imagesToDelete = [];

    // Add thumbnail if exists
    if (product.thumbnailImage) {
      imagesToDelete.push(product.thumbnailImage);
    }

    // Handle simple product colors
    if (product.type === 'simple' && product.colors) {
      product.colors.forEach(color => {
        if (color.images && color.images.length) {
          imagesToDelete.push(...color.images);
        }
      });
    }

    // Handle variable product models
    if (product.type === 'variable' && product.models) {
      product.models.forEach(model => {
        if (model.colors) {
          model.colors.forEach(color => {
            if (color.images && color.images.length) {
              imagesToDelete.push(...color.images);
            }
          });
        }
      });
    }

    // Delete all images
    for (const imageUrl of imagesToDelete) {
      await deleteImageFile(imageUrl);
    }

    console.log(`✅ Deleted ${imagesToDelete.length} images for product ${product.productId}`);
  } catch (err) {
    console.error(`❌ Error deleting images for product ${product.productId}:`, err.message);
    // Don't throw - we still want to delete the product even if image deletion fails
  }
};

async function createInventoryEntries(product) {
  try {
    if (product.type === "simple") {
      if (product.colors && product.colors.length > 0) {
        for (const color of product.colors) {
          // Check if inventory entry already exists to avoid duplicates
          const existing = await Inventory.findOne({
            productId: product.productId,
            colorId: color.colorId,
          });
          if (existing) continue;

          await Inventory.create({
            productId: product.productId,
            productName: product.productName,
            modelName: product.modelName || "Default",
            colorId: color.colorId,
            colorName: color.colorName,
            stock: 0,
            threshold: 10,
            isActive: true,
            inventoryType: "batch",
            batches: [],
            sellingPrice: color.currentPrice || 0,
            category: product.categoryName || "General",
            hsnCode: product.hsnCode || "",
            taxSlab: product.taxSlab || 18,
            totalValue: 0,
          });
        }
      }
    } else if (product.type === "variable") {
      if (product.models && product.models.length > 0) {
        for (const model of product.models) {
          if (model.colors && model.colors.length > 0) {
            for (const color of model.colors) {
              const existing = await Inventory.findOne({
                productId: product.productId,
                colorId: color.colorId,
              });
              if (existing) continue;

              await Inventory.create({
                productId: product.productId,
                productName: product.productName,
                variableModelName: model.modelName,
                variableModelId: model._id || model.modelId,
                colorId: color.colorId,
                colorName: color.colorName,
                stock: 0,
                threshold: 10,
                isActive: true,
                inventoryType: "batch",
                batches: [],
                sellingPrice: color.currentPrice || 0,
                category: product.categoryName || "General",
                hsnCode: product.hsnCode || "",
                taxSlab: product.taxSlab || 18,
                totalValue: 0,
              });
            }
          }
        }
      }
    }
    console.log("✅ Inventory entries created for product:", product.productId);
  } catch (err) {
    console.error("❌ Error creating inventory entries:", err.message);
  }
}

// ─── Middleware shorthand ─────────────────────────────────────────────────────

const uploadAny = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🟢 ADD PRODUCT
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/add", adminAuth, uploadAny, async (req, res) => {
  try {
    const data = req.body;
    const files = req.files || [];

    if (!data.productId) data.productId = uuidv4();

    data.specifications = parseField(data.specifications);
    data.models = parseField(data.models);
    data.colors = parseField(data.colors);
    if (data.taxSlab) data.taxSlab = parseInt(data.taxSlab);

    const thumbnailFile = files.find(f => f.fieldname === 'thumbnail');
    const colorImages = files.filter(f => f.fieldname.startsWith('colorImages'));
    const modelImages = files.filter(f => f.fieldname.startsWith('modelImages'));

    if (thumbnailFile) {
      data.thumbnailImage = createImageUrl(req, thumbnailFile.filename);
    }

    if (data.type === "simple") {
      if (data.colors) {
        data.colors = data.colors.map(color => ({
          ...color,
          colorId: color.colorId || uuidv4(),
          images: color.images || [],
        }));

        if (colorImages.length > 0) {
          const uploadedImages = {};
          colorImages.forEach(file => {
            const match = file.fieldname.match(/colorImages\[(\d+)\]/);
            if (match) {
              const idx = parseInt(match[1]);
              if (!uploadedImages[idx]) uploadedImages[idx] = [];
              uploadedImages[idx].push(createImageUrl(req, file.filename));
            }
          });
          Object.keys(uploadedImages).forEach(idx => {
            const i = parseInt(idx);
            if (data.colors[i]) {
              data.colors[i].images = [...(data.colors[i].images || []), ...uploadedImages[i]];
            }
          });
        }
      }

    } else if (data.type === "variable") {
      if (data.models) {
        data.models = data.models.map(model => ({
          ...model,
          colors: (model.colors || []).map(color => ({
            ...color,
            colorId: color.colorId || uuidv4(),
            images: color.images || [],
          })),
        }));

        if (modelImages.length > 0) {
          const uploadedModelImages = {};
          modelImages.forEach(file => {
            const match = file.fieldname.match(/modelImages\[(\d+)\]\[(\d+)\]/);
            if (match) {
              const mi = parseInt(match[1]);
              const ci = parseInt(match[2]);
              if (!uploadedModelImages[mi]) uploadedModelImages[mi] = {};
              if (!uploadedModelImages[mi][ci]) uploadedModelImages[mi][ci] = [];
              uploadedModelImages[mi][ci].push(createImageUrl(req, file.filename));
            }
          });
          Object.keys(uploadedModelImages).forEach(mi => {
            Object.keys(uploadedModelImages[mi]).forEach(ci => {
              if (data.models[mi]?.colors?.[ci]) {
                data.models[mi].colors[ci].images = [
                  ...(data.models[mi].colors[ci].images || []),
                  ...uploadedModelImages[mi][ci],
                ];
              }
            });
          });
        }
      }
    }

    data.isActive = true;
    data.createdAt = new Date();
    data.updatedAt = new Date();

    const product = await Product.create(data);
    await createInventoryEntries(product);

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🟡 UPDATE PRODUCT
// ─ Now also handles removedImages[] — URLs to strip from existing gallery
// ═══════════════════════════════════════════════════════════════════════════════

router.put("/update/:productId", adminAuth, uploadAny, async (req, res) => {
  try {
    const { productId } = req.params;
    const data = req.body;
    const files = req.files || [];

    const existingProduct = await Product.findOne({ productId });
    if (!existingProduct) return res.status(404).json({ message: "Product not found" });

    data.specifications = parseField(data.specifications);
    data.models = parseField(data.models);
    data.colors = parseField(data.colors);
    if (data.taxSlab) data.taxSlab = parseInt(data.taxSlab);

    // ── Parse removed images sent from frontend ──────────────────────────────
    const removedImages = parseField(data.removedImages);

    const thumbnailFile = files.find(f => f.fieldname === 'thumbnail');
    const colorImages = files.filter(f => f.fieldname.startsWith('colorImages'));
    const modelImages = files.filter(f => f.fieldname.startsWith('modelImages'));

    if (thumbnailFile) {
      data.thumbnailImage = createImageUrl(req, thumbnailFile.filename);
    }

    // Delete removed images from server
    if (removedImages.length > 0) {
      for (const imgUrl of removedImages) {
        await deleteImageFile(imgUrl);
      }
    }

    if (data.type === "simple") {
      if (data.colors) {
        // ── Strip removed images from existing saved URLs ─────────────────────
        data.colors = data.colors.map(color => {
          let existingImgs = (color.images || []).filter(img => typeof img === 'string');

          if (removedImages.length > 0) {
            existingImgs = existingImgs.filter(imgUrl => !removedImages.includes(imgUrl));
          }

          return { ...color, images: existingImgs };
        });

        // ── Append newly uploaded images ──────────────────────────────────────
        if (colorImages.length > 0) {
          const uploadedImages = {};
          colorImages.forEach(file => {
            const match = file.fieldname.match(/colorImages\[(\d+)\]/);
            if (match) {
              const idx = parseInt(match[1]);
              if (!uploadedImages[idx]) uploadedImages[idx] = [];
              uploadedImages[idx].push(createImageUrl(req, file.filename));
            }
          });
          Object.keys(uploadedImages).forEach(idx => {
            const i = parseInt(idx);
            if (data.colors[i]) {
              if (!data.colors[i].colorId) data.colors[i].colorId = uuidv4();
              data.colors[i].images = [...(data.colors[i].images || []), ...uploadedImages[i]];
            }
          });
        }
      }

    } else if (data.type === "variable") {
      if (data.models) {
        // ── Strip removed images from variable models ─────────────────────────
        data.models = data.models.map(model => ({
          ...model,
          colors: (model.colors || []).map(color => {
            let existingImgs = (color.images || []).filter(img => typeof img === 'string');
            if (removedImages.length > 0) {
              existingImgs = existingImgs.filter(imgUrl => !removedImages.includes(imgUrl));
            }
            return { ...color, images: existingImgs };
          }),
        }));

        // ── Append newly uploaded model images ────────────────────────────────
        if (modelImages.length > 0) {
          const uploadedModelImages = {};
          modelImages.forEach(file => {
            const match = file.fieldname.match(/modelImages\[(\d+)\]\[(\d+)\]/);
            if (match) {
              const mi = parseInt(match[1]);
              const ci = parseInt(match[2]);
              if (!uploadedModelImages[mi]) uploadedModelImages[mi] = {};
              if (!uploadedModelImages[mi][ci]) uploadedModelImages[mi][ci] = [];
              uploadedModelImages[mi][ci].push(createImageUrl(req, file.filename));
            }
          });
          Object.keys(uploadedModelImages).forEach(mi => {
            Object.keys(uploadedModelImages[mi]).forEach(ci => {
              if (data.models[mi]?.colors?.[ci]) {
                if (!data.models[mi].colors[ci].colorId) {
                  data.models[mi].colors[ci].colorId = uuidv4();
                }
                data.models[mi].colors[ci].images = [
                  ...(data.models[mi].colors[ci].images || []),
                  ...uploadedModelImages[mi][ci],
                ];
              }
            });
          });
        }
      }
    }

    data.updatedAt = new Date();

    const updated = await Product.findOneAndUpdate(
      { productId },
      { $set: data },
      { new: true, runValidators: true }
    );

    await createInventoryEntries(updated);

    res.json({ message: "Product updated successfully", product: updated });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 SOFT DELETE PRODUCT — Deactivate
// ═══════════════════════════════════════════════════════════════════════════════

router.delete("/delete/:productId", adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const deleted = await Product.findOneAndUpdate(
      { productId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    await Inventory.updateMany(
      { productId },
      { isActive: false, updatedAt: new Date() }
    );

    res.json({ message: "Product deactivated successfully", product: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 PERMANENT DELETE PRODUCT — Hard delete with image cleanup
// ═══════════════════════════════════════════════════════════════════════════════

router.delete("/permanent/:productId", adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    // Find the product first to get all image URLs
    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete all associated images from server storage
    await deleteProductImages(product);

    // Hard delete from Product collection
    await Product.findOneAndDelete({ productId });

    // Hard delete from Inventory collection
    await Inventory.deleteMany({ productId });

    console.log(`✅ Permanently deleted product: ${productId}`);
    res.json({
      message: "Product permanently deleted successfully",
      productId: productId
    });
  } catch (err) {
    console.error("Error permanently deleting product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🟢 ACTIVATE PRODUCT
// ═══════════════════════════════════════════════════════════════════════════════

router.put("/activate/:productId", adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const activated = await Product.findOneAndUpdate(
      { productId },
      { isActive: true, updatedAt: new Date() },
      { new: true }
    );

    // Re-activate its inventory entries too
    await Inventory.updateMany(
      { productId },
      { isActive: true, updatedAt: new Date() }
    );

    res.json({ message: "Product activated successfully", product: activated });
  } catch (err) {
    console.error("Error activating product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🟦 GET ALL ACTIVE PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/all", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🟦 GET ALL DEACTIVATED PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/deactivated", async (req, res) => {
  try {
    const products = await Product.find({ isActive: false }).sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🟦 GET SINGLE PRODUCT
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    // Allow fetching deactivated products too (for admin read-only view)
    const product = await Product.findOne({ productId });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 🟦 GET PRODUCT BY NAME (for direct URL access)
router.get("/by-name/:productName", async (req, res) => {
  try {
    // Get the product name from URL
    let productNameParam = req.params.productName;

    console.log("🔍 Raw URL parameter:", productNameParam);

    // Decode URL encoding first
    let decodedName = decodeURIComponent(productNameParam);
    console.log("🔍 After decodeURIComponent:", decodedName);

    // Convert URL format back to readable format
    // Step 1: Replace hyphens with spaces (but handle multiple hyphens)
    let searchName = decodedName.replace(/-+/g, ' ');  // Replace one or more hyphens with single space
    console.log("🔍 After replacing hyphens with spaces:", searchName);

    // Step 2: Trim extra spaces
    searchName = searchName.trim();

    // Step 3: Capitalize first letter of each word (optional, for better matching)
    searchName = searchName.replace(/\b\w/g, (c) => c.toUpperCase());
    console.log("🔍 Final search name:", searchName);

    // Try exact match first (case-insensitive)
    let product = await Product.findOne({
      productName: { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') },
      isActive: true
    });

    // If exact match not found, try partial match
    if (!product) {
      console.log("🔍 Exact match not found, trying partial match...");
      product = await Product.findOne({
        productName: { $regex: escapeRegex(searchName), $options: 'i' },
        isActive: true
      });
    }

    // If still not found, try without special characters
    if (!product) {
      console.log("🔍 Partial match not found, trying without special chars...");
      const cleanName = searchName.replace(/[^\w\s]/g, '').trim();
      product = await Product.findOne({
        productName: { $regex: escapeRegex(cleanName), $options: 'i' },
        isActive: true
      });
    }

    // If no product found
    if (!product) {
      console.log("❌ Product not found for name:", searchName);
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log("✅ Product found:", product.productName, "ID:", product.productId);

    // Return the product data
    res.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error('❌ Error finding product by name:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



// 🟦 GET PRODUCT BY SLUG (for direct URL access)
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log("🔍 Searching for product with slug:", slug);

    const product = await Product.findOne({ slug, isActive: true });

    if (!product) {
      console.log("❌ Product not found with slug:", slug);
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log("✅ Product found:", product.productName, "ID:", product.productId);
    res.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error('❌ Error finding product by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



module.exports = router;