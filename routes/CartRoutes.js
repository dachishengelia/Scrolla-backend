import express from "express";
import mongoose from "mongoose";
import isAuth from "../middlewares/isAuth.middleware.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

const router = express.Router();

// Get the authenticated user's cart
router.get("/", isAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId, status: "active" })
      .populate("products.product", "name price imageUrl");
    if (!cart) {
      return res.json({ products: [], total: 0 });
    }
    const total = cart.products.reduce((sum, item) => {
      return sum + (item.product?.price || 0) * item.quantity;
    }, 0);
    res.json({ products: cart.products, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cart", error: err.message });
  }
});

// Add a product to the cart
router.post("/add", isAuth, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: "Product ID required" });
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let cart = await Cart.findOne({ user: req.userId, status: "active" });
    if (!cart) {
      cart = new Cart({ user: req.userId, products: [] });
    }
    const idx = cart.products.findIndex(p => p.product.toString() === productId);
    if (idx >= 0) {
      // Already in cart, do nothing for idempotency
    } else {
      cart.products.push({ product: productId, quantity: 1 });
      await cart.save();
    }
    // Populate and calculate total
    await cart.populate("products.product", "name price imageUrl");
    const total = cart.products.reduce((sum, item) => {
      return sum + (item.product?.price || 0) * item.quantity;
    }, 0);
    res.json({ products: cart.products, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to add product", error: err.message });
  }
});

// Remove a product from the cart
router.delete("/remove/:productId", isAuth, async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }
  try {
    const cart = await Cart.findOne({ user: req.userId, status: "active" });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    cart.products = cart.products.filter(p => p.product.toString() !== productId);
    await cart.save();
    // Populate and calculate total
    await cart.populate("products.product", "name price imageUrl");
    const total = cart.products.reduce((sum, item) => {
      return sum + (item.product?.price || 0) * item.quantity;
    }, 0);
    res.json({ products: cart.products, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove product", error: err.message });
  }
});

export default router;
