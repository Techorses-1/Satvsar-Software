const mongoose = require("mongoose");

const SpecificationSchema = new mongoose.Schema({
  key: String,
  value: String,
});

const ColorSpecificationSchema = new mongoose.Schema({
  key: String,
  value: String,
});

const ColorSchema = new mongoose.Schema({
  colorId: {
    type: String,
    required: true,
    default: () => require('uuid').v4(),
  },
  colorName: {
    type: String,
    required: true,
  },
  fragrances: [String],
  images: [String],
  originalPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  colorSpecifications: [ColorSpecificationSchema],
});

const ModelSchema = new mongoose.Schema({
  modelName: {
    type: String,
    required: true,
  },
  description: String,
  SKU: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
  },
  modelSpecifications: [SpecificationSchema],
  colors: [ColorSchema],
});

const ProductSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    default: () => require('uuid').v4(),
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  description: String,
  categoryId: {
    type: String,
    required: true,
  },
  categoryName: String,
  hsnCode: String,
  taxSlab: {
    type: Number,
    default: 5,
  },
  type: {
    type: String,
    enum: ["simple", "variable"],
    default: "simple",
  },
  modelName: String,
  SKU: {
    type: String,
    unique: true,
    sparse: true,
  },
  specifications: [SpecificationSchema],
  colors: [ColorSchema],
  models: [ModelSchema],
  thumbnailImage: String,
  originalPrice: Number,
  currentPrice: Number,
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
});

// Helper function to create slug from product name
function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
}

// Pre-save middleware to auto-generate slug
ProductSchema.pre('save', function (next) {
  if (this.productName && (!this.slug || this.isModified('productName'))) {
    this.slug = createSlug(this.productName);
  }
  this.updatedAt = Date.now();
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model("Product", ProductSchema);