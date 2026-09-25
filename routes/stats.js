import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";

const router = express.Router();

/* ===========================
    GET TOTAL USERS COUNT
=========================== */
router.get("/users", async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("Error fetching user count:", err);
    res.status(500).json({ message: "Failed to fetch user count" });
  }
});

/* ===========================
    GET TOTAL PRODUCTS COUNT
=========================== */
router.get("/products", async (req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("Error fetching product count:", err);
    res.status(500).json({ message: "Failed to fetch product count" });
  }
});

export default router;
