const mongoose = require("mongoose");

// Your exact MongoDB connection
const MONGODB_URI = "mongodb://admin:Admin%402025@89.116.236.84:27017/ecommerecebackend?authSource=admin&authMechanism=SCRAM-SHA-256";

// Your Product Schema (copy exactly from your model)
const SpecificationSchema = new mongoose.Schema({
  key: String,
  value: String,
});

const ColorSpecificationSchema = new mongoose.Schema({
  key: String,
  value: String,
});

const ColorSchema = new mongoose.Schema({
  colorId: String,
  colorName: String,
  fragrances: [String],
  images: [String],
  originalPrice: Number,
  currentPrice: Number,
  colorSpecifications: [ColorSpecificationSchema],
});

const ModelSchema = new mongoose.Schema({
  modelName: String,
  description: String,
  SKU: String,
  modelSpecifications: [SpecificationSchema],
  colors: [ColorSchema],
});

const ProductSchema = new mongoose.Schema({
  productId: String,
  productName: String,
  slug: String,
  description: String,
  categoryId: String,
  categoryName: String,
  hsnCode: String,
  type: String,
  modelName: String,
  SKU: String,
  specifications: [SpecificationSchema],
  colors: [ColorSchema],
  models: [ModelSchema],
  thumbnailImage: String,
  originalPrice: Number,
  currentPrice: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
});

const Product = mongoose.model('Product', ProductSchema);

async function addSlugs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    let updated = 0;

    for (const product of products) {
      if (!product.productName) {
        console.log(`⚠️ Skipping product with no name: ${product._id}`);
        continue;
      }

      // Create slug from product name
      let slug = product.productName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')  // Remove special chars
        .replace(/\s+/g, '-')       // Spaces to hyphens
        .replace(/-+/g, '-')        // Multiple hyphens to single
        .replace(/^-+|-+$/g, '');   // Remove leading/trailing hyphens

      // Make sure slug is unique
      let uniqueSlug = slug;
      let counter = 1;
      let existingProduct = await Product.findOne({ slug: uniqueSlug, _id: { $ne: product._id } });
      
      while (existingProduct) {
        uniqueSlug = `${slug}-${counter}`;
        existingProduct = await Product.findOne({ slug: uniqueSlug, _id: { $ne: product._id } });
        counter++;
      }

      await Product.updateOne(
        { _id: product._id },
        { $set: { slug: uniqueSlug } }
      );
      
      console.log(`✅ ${product.productName.substring(0, 50)}... -> ${uniqueSlug}`);
      updated++;
    }

    console.log(`\n✅ Done! Updated ${updated} products with slugs`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addSlugs();