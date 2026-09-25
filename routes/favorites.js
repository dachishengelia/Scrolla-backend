import express from "express";
import isAuth from "../middlewares/isAuth.middleware.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

const router = express.Router();

// Helper function to normalize product with imageUrl
const normalizeProduct = (product) => {
  if (!product) return null;
  const productObj = product.toObject ? product.toObject() : product;
  if (product.images && product.images.length > 0) {
    const mainImage = product.images.find(img => img.isMain) || product.images[0];
    productObj.imageUrl = mainImage.url;
  } else {
    productObj.imageUrl = null;
  }
  return productObj;
};

// GET /api/favorites - Retrieve user's favorite products with full data
router.get("/", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "favorites",
      populate: { path: "sellerId", select: "username email" }
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Normalize each product to include imageUrl
    const favorites = (user.favorites || []).map(normalizeProduct);
    res.json({ favorites });
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/favorites - Add product to favorites
router.post("/", isAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add if not already present (idempotent)
    if (!user.favorites.some(id => id.equals(productId))) {
      user.favorites.push(productId);
      await user.save();
    }

    res.json({ productIds: user.favorites });
  } catch (err) {
    console.error("Error adding to favorites:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/favorites/:productId - Remove product from favorites
router.delete("/:productId", isAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove if present
    user.favorites = user.favorites.filter(id => !id.equals(productId));
    await user.save();

    res.json({ productIds: user.favorites });
  } catch (err) {
    console.error("Error removing from favorites:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;