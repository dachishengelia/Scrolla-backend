import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const isAuth = async (req, res, next) => {
  let token = req.cookies?.token;

  // Also check Authorization header for Bearer token
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    console.error("No token found in cookies or Authorization header");
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Accept either payload.id or payload._id (defensive)
    const tokenUserId = payload?.id || payload?._id;

    if (!tokenUserId) {
      console.error("Token missing id/_id field:", payload);
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // Optional: verify it's a valid ObjectId string before lookup
    if (!mongoose.isValidObjectId(tokenUserId)) {
      console.error("Invalid user id in token:", tokenUserId);
      return res.status(401).json({ message: "Invalid token user id" });
    }

    const user = await User.findById(tokenUserId);
    if (!user) {
      console.error("User not found for token id:", tokenUserId);
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.user = user;
    // store string version of _id for consistency
    req.userId = user._id.toString();
    req.role = user.role;
    next();
  } catch (err) {
    console.error("Invalid token:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const isSeller = (req, res, next) => {
  if (req.user?.role !== "seller") {
    return res.status(403).json({ message: "Access denied: Seller role required" });
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admin role required" });
  }
  next();
};

export default isAuth;
