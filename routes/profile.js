// routes/profile.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { upload } from "../config/cloudinary.config.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Update username
router.patch("/me/username", async (req, res) => {
  const { username, email, password } = req.body;
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.email !== email) return res.status(400).json({ message: "Incorrect email" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    user.username = username;
    await user.save();

    res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update avatar
router.patch("/me/avatar", upload.single("avatar"), async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    // Save Cloudinary URL
    user.avatar = req.file.path;
    await user.save();

    res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update role
router.patch("/me/role", async (req, res) => {
  const { newRole, email, password } = req.body;
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.email !== email) return res.status(400).json({ message: "Incorrect email" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    if (!["buyer", "seller"].includes(newRole)) return res.status(400).json({ message: "Invalid role" });
    if (user.role === "admin") return res.status(403).json({ message: "Admin role cannot be changed" });

    user.role = newRole;
    await user.save();

    res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
