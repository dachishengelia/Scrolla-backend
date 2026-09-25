import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  mainCategory: { type: String, required: true },
  subcategory: { type: String, required: true },
  discount: { type: Number, default: 0 },
  secondhand: { type: Boolean, default: false },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  images: [{
    url: String,
    isMain: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  }],
  sizes: [{ type: String }],
  colors: [{ type: String }],
  tags: [{ type: String }],
  brand: { type: String },
  createdAt: { type: Date, default: Date.now },


  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema]
});

// Normalize mainCategory to lowercase and trimmed on save
productSchema.pre('save', function(next) {
  if (this.mainCategory) {
    this.mainCategory = this.mainCategory.toLowerCase().trim();
  }
  next();
});

// Virtual for backward compatibility: return the main image URL
productSchema.virtual('imageUrl').get(function() {
  if (this.images && this.images.length > 0) {
    const mainImage = this.images.find(img => img.isMain) || this.images[0];
    return mainImage.url;
  }
  return null;
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
