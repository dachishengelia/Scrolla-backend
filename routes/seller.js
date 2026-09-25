import express from "express";
import Product from "../models/Product.js"; 
import isAuth, { isSeller } from "../middlewares/isAuth.middleware.js";

const router = express.Router();

router.post("/products", isAuth, isSeller, async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || !price) return res.status(400).json({ message: "Name and price are required" });

  try {
    const product = new Product({
      name,
      description,
      price,
      sellerId: req.userId, 
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/products", isAuth, isSeller, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.userId }).lean();
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found for this seller" });
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch seller products", error: err.message });
  }
});

router.patch("/products/:id", isAuth, isSeller, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.userId },
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/products/:id", isAuth, isSeller, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, sellerId: req.userId });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
