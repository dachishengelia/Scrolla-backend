// routes/users.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { upload } from "../config/cloudinary.config.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ------------------------------
// Update username and/or password
// ------------------------------
router.patch("/update", isAuth, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update username
    if (username) {
      if (!currentPassword) return res.status(400).json({ message: "Current password required to change username" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

      user.username = username;
    }

    // Update password
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Current password required to change password" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// Update avatar only
// ------------------------------
router.patch("/update-avatar", isAuth, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!req.file || !req.file.path) return res.status(400).json({ message: "No image uploaded" });

    user.avatar = req.file.path;
    await user.save();

    res.json({
      message: "Avatar updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET USER PROFILE
// ------------------------------
router.get("/:userId/profile", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(userId).select("_id username avatar bio role createdAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    const productCount = await Product.countDocuments({ sellerId: userId });

    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      productCount
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET USER'S PRODUCTS
// ------------------------------
router.get("/:userId/products", async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sort = "newest" } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    let sortStage = {};
    if (sort === "newest") sortStage = { createdAt: -1 };
    else if (sort === "oldest") sortStage = { createdAt: 1 };
    else if (sort === "most-liked") sortStage = { likesCount: -1 };

    const products = await Product.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(userId) } },
      { $addFields: { likesCount: { $size: "$likes" } } },
      { $sort: sortStage },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller"
        }
      },
      { $unwind: "$seller" },
      { $project: { "seller.password": 0, "seller.cart": 0, "seller.favorites": 0, "seller.userFavorites": 0 } }
    ]);

    const total = await Product.countDocuments({ sellerId: userId });

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    console.error("User products fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET USER'S FAVORITES (PRODUCTS)
// ------------------------------
router.get("/:userId/favorites", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(userId).populate("favorites");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.favorites);
  } catch (err) {
    console.error("User favorites fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET USER'S COMMENTS
// ------------------------------
router.get("/:userId/comments", async (req, res) => {
  const { userId } = req.params;
  const { limit = 3 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const products = await Product.find({ "comments.userId": userId })
      .select("comments name")
      .sort({ "comments.createdAt": -1 })
      .limit(limit * 1)
      .lean();

    const comments = [];
    products.forEach(product => {
      product.comments.forEach(comment => {
        if (comment.userId.toString() === userId) {
          comments.push({
            ...comment,
            productName: product.name
          });
        }
      });
    });

    res.json(comments.slice(0, limit));
  } catch (err) {
    console.error("User comments fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// ADD USER TO FAVORITES
// ------------------------------
router.post("/:userId/favorite", isAuth, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  if (req.userId === userId) {
    return res.status(400).json({ message: "Cannot favorite yourself" });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.userFavorites.includes(userId)) {
      return res.status(400).json({ message: "User already favorited" });
    }

    user.userFavorites.push(userId);
    await user.save();

    res.json({ message: "User added to favorites" });
  } catch (err) {
    console.error("Add favorite error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// REMOVE USER FROM FAVORITES
// ------------------------------
router.delete("/:userId/favorite", isAuth, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const index = user.userFavorites.indexOf(userId);
    if (index === -1) {
      return res.status(400).json({ message: "User not in favorites" });
    }

    user.userFavorites.splice(index, 1);
    await user.save();

    res.json({ message: "User removed from favorites" });
  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// CHECK IF USER IS FAVORITED
// ------------------------------
router.get("/:userId/is-favorited", isAuth, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isFavorited = user.userFavorites.includes(userId);
    res.json({ isFavorited });
  } catch (err) {
    console.error("Check favorite error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET CURRENT USER'S FAVORITE USERS
// ------------------------------
router.get("/favorites", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("userFavorites", "_id username avatar bio");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.userFavorites);
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: GET USER PROFILE (with subscriber counts)
// ------------------------------
router.get("/:id/profile", isAuth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id)
      .select("username displayName bio location website avatar banner subscribers subscribing");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSubscribed = user.subscribers.some(userId => userId.toString() === req.userId);

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        bio: user.bio,
        location: user.location,
        website: user.website,
        avatar: user.avatar,
        banner: user.banner,
        subscribersCount: user.subscribers.length,
        subscribingCount: user.subscribing.length,
        isSubscribed
      }
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: UPDATE PROFILE
// ------------------------------
router.patch("/me", isAuth, async (req, res) => {
  const { displayName, bio, location, website } = req.body;

  try {
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select("username displayName bio location website avatar banner");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        avatar: user.avatar,
        banner: user.banner
      }
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: UPLOAD AVATAR
// ------------------------------
router.patch("/me/avatar", isAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: req.file.path },
      { new: true }
    ).select("username displayName avatar");

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: UPLOAD BANNER
// ------------------------------
router.patch("/me/banner", isAuth, upload.single("banner"), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { banner: req.file.path },
      { new: true }
    ).select("username displayName banner");

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        banner: user.banner
      }
    });
  } catch (err) {
    console.error("Banner upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: SUBSCRIBE TO USER
// ------------------------------
router.post("/:id/subscribe", isAuth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  if (id === req.userId) {
    return res.status(400).json({ message: "Cannot subscribe to yourself" });
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(req.userId);

    // Check if already subscribed
    if (currentUser.subscribing.some(userId => userId.toString() === id)) {
      return res.status(400).json({ message: "Already subscribed to this user" });
    }

    // Add to subscribing list
    currentUser.subscribing.push(id);
    await currentUser.save();

    // Add to subscribers list
    targetUser.subscribers.push(req.userId);
    await targetUser.save();

    res.json({ message: "Subscribed successfully", subscribed: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: UNSUBSCRIBE FROM USER
// ------------------------------
router.delete("/:id/subscribe", isAuth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove from subscribing list
    currentUser.subscribing = currentUser.subscribing.filter(
      userId => userId.toString() !== id
    );
    await currentUser.save();

    // Remove from subscribers list
    targetUser.subscribers = targetUser.subscribers.filter(
      userId => userId.toString() !== req.userId
    );
    await targetUser.save();

    res.json({ message: "Unsubscribed successfully", subscribed: false });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: GET SUBSCRIBERS LIST
// ------------------------------
router.get("/:id/subscribers", isAuth, async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id).populate({
      path: "subscribers",
      select: "username displayName avatar",
      options: { skip, limit }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subscribers = user.subscribers.map(u => ({
      _id: u._id,
      username: u.username,
      displayName: u.displayName || u.username,
      avatar: u.avatar
    }));

    res.json({ subscribers, page, hasMore: user.subscribers.length === limit });
  } catch (err) {
    console.error("Get subscribers error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// SOCIAL: GET SUBSCRIBING LIST
// ------------------------------
router.get("/:id/subscribing", isAuth, async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id).populate({
      path: "subscribing",
      select: "username displayName avatar",
      options: { skip, limit }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subscribing = user.subscribing.map(u => ({
      _id: u._id,
      username: u.username,
      displayName: u.displayName || u.username,
      avatar: u.avatar
    }));

    res.json({ subscribing, page, hasMore: user.subscribing.length === limit });
  } catch (err) {
    console.error("Get subscribing error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// POSTS: GET LIKED POSTS BY USER
// ------------------------------
import Post from "../models/Post.js";

router.get("/:id/liked", isAuth, async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ likes: id })
      .populate("author", "username displayName avatar")
      .populate("originalPost", "content imageUrl author")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ likes: id });

    res.json({
      posts,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Get liked posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// POSTS: GET REPOSTS BY USER
// ------------------------------
router.get("/:id/reposts", isAuth, async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find posts where this user is in the reposts array (original posts they reposted)
    const posts = await Post.find({ reposts: id })
      .populate("author", "username displayName avatar")
      .populate("originalPost", "content imageUrl author")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ reposts: id });

    res.json({
      posts,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Get user reposts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

// ------------------------------
// SEARCH USERS
// ------------------------------
router.get("/", async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  try {
    let query = {};
    if (q && q.trim()) {
      query = {
        $or: [
          { username: { $regex: q.trim(), $options: "i" } },
          { displayName: { $regex: q.trim(), $options: "i" } }
        ]
      };
    }

    const users = await User.find(query)
      .select("username displayName avatar bio")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
