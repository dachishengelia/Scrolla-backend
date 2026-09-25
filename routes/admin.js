import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/order.model.js";
import isAuth, { isAdmin } from "../middlewares/isAuth.middleware.js";

const router = express.Router();

router.get("/stats", isAuth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const buyers = await User.countDocuments({ role: "buyer" });
    const sellers = await User.countDocuments({ role: "seller" });
    const admins = await User.countDocuments({ role: "admin" });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });

    res.json({ totalUsers, buyers, sellers, admins, newThisMonth });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.get("/users", isAuth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "username email role createdAt").lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/users/:id/role", isAuth, isAdmin, async (req, res) => {
  const { role } = req.body;
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/users/:id", isAuth, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/products', isAuth, isAdmin, async (req, res) => {
  try {
    const { name, price, description, mainCategory, subcategory, sellerId, sizes, colors } = req.body;

    if (!sellerId) {
      return res.status(400).json({ message: "Seller ID is required" });
    }

    const product = new Product({
      name,
      price,
      description,
      mainCategory,
      subcategory,
      sellerId,
      sizes: sizes || [],
      colors: colors || [],
    });

    await product.save();
    res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});


router.patch('/orders/:id/status', isAuth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['placed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});


export default router;
