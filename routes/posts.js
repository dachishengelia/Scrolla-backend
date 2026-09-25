import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import isAuth from "../middlewares/isAuth.middleware.js";
import Post from "../models/Post.js";
import {
  getFeedPosts,
  createPost,
  getPost,
  deletePost,
  toggleLike,
  addComment,
  getComments,
  deleteComment,
  searchPosts,
  getUserPosts
} from "../controllers/postsController.js";

const router = express.Router();

// Configure Cloudinary storage for posts
const postStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "scrolla/posts",
    allowed_formats: ["jpg", "png", "jpeg", "gif", "webp"]
  }
});

const uploadPost = multer({ storage: postStorage });

// =====================
// PUBLIC ROUTES (no auth needed)
// =====================

// Get all posts (public feed)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "username avatar")
      .lean();

    const total = await Post.countDocuments();

    res.json({
      posts,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// PROTECTED ROUTES (auth required)
// =====================

// Get feed posts
router.get("/feed", isAuth, getFeedPosts);

// Search posts
router.get("/search", isAuth, searchPosts);

// Get posts by user
router.get("/user/:id", isAuth, getUserPosts);

// Get posts liked by current user
router.get("/liked", isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ likes: req.userId })
      .populate("author", "username displayName avatar")
      .populate("originalPost", "content imageUrl author")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ likes: req.userId });

    res.json({
      posts,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Error fetching liked posts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single post
router.get("/:id", isAuth, getPost);

// Get comments for a post
router.get("/:id/comments", isAuth, getComments);

// Get who reposted a post
router.get("/:id/reposts", isAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id).populate("reposts", "username displayName avatar");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ reposts: post.reposts });
  } catch (err) {
    console.error("Error fetching reposts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// POST ROUTES
// =====================

// Create post
router.post("/", isAuth, createPost);

// Like/unlike post
router.post("/:id/like", isAuth, toggleLike);

// Repost a post
router.post("/:id/repost", isAuth, async (req, res) => {
  console.log("[REPOST] ==== START ====");
  console.log("[REPOST] Post ID:", req.params.id);
  console.log("[REPOST] User ID:", req.userId);
  
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Find the post
    console.log("[REPOST] Finding post:", id);
    const originalPost = await Post.findById(id);
    
    if (!originalPost) {
      console.log("[REPOST] Post not found");
      return res.status(404).json({ message: "Post not found" });
    }
    
    console.log("[REPOST] Post found, author:", originalPost.author);
    console.log("[REPOST] Current reposts:", originalPost.reposts);

    // Check if already reposted
    const userIdStr = req.userId.toString();
    const alreadyReposted = originalPost.reposts.some(
      userId => userId.toString() === userIdStr
    );
    
    if (alreadyReposted) {
      console.log("[REPOST] Already reposted");
      return res.status(400).json({ message: "Already reposted this post" });
    }

    // Add repost to original post
    console.log("[REPOST] Adding user to reposts array");
    originalPost.reposts.push(req.userId);
    await originalPost.save();
    console.log("[REPOST] Original post saved");

    // Create repost record - content is required by the model, so provide default
    console.log("[REPOST] Creating repost record");
    const repost = new Post({
      author: req.userId,
      content: content || "Repost", // Must provide non-empty content
      originalPost: id
    });

    await repost.save();
    console.log("[REPOST] Repost saved:", repost._id);
    
    await repost.populate("author", "username displayName avatar");
    await repost.populate("originalPost", "content imageUrl author");

    console.log("[REPOST] ==== SUCCESS ====");
    res.status(201).json(repost);
  } catch (err) {
    console.error("[REPOST] ==== ERROR ====");
    console.error("[REPOST] Error:", err);
    console.error("[REPOST] Stack:", err.stack);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Add comment to post
router.post("/:id/comment", isAuth, addComment);

// Upload image for post
router.post("/upload", isAuth, uploadPost.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }
  res.json({ imageUrl: req.file.path });
});

// =====================
// PUT ROUTES
// =====================

// Update post
router.put("/:id", isAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (!post.author.equals(req.userId)) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    if (content) post.content = content;
    if (imageUrl !== undefined) post.imageUrl = imageUrl;

    await post.save();
    await post.populate("author", "username displayName avatar");

    res.json(post);
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// BOOKMARK ROUTES
// =====================

// Bookmark post
router.post("/:id/bookmark", isAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyBookmarked = post.bookmarks.some(userId => userId.equals(req.userId));
    if (alreadyBookmarked) {
      return res.status(400).json({ message: "Already bookmarked" });
    }

    post.bookmarks.push(req.userId);
    await post.save();

    res.json({ success: true, bookmarked: true });
  } catch (err) {
    console.error("Error bookmarking:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Remove bookmark
router.delete("/:id/bookmark", isAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.bookmarks = post.bookmarks.filter(userId => !userId.equals(req.userId));
    await post.save();

    res.json({ success: true, bookmarked: false });
  } catch (err) {
    console.error("Error removing bookmark:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// THREAD/REPLY ROUTES
// =====================

// Get post replies (thread)
router.get("/:id/replies", isAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const replies = await Post.find({ parentId: id })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ parentId: id });

    res.json({
      posts: replies,
      page,
      hasMore: skip + limit < total
    });
  } catch (err) {
    console.error("Error fetching replies:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add thread reply
router.post("/:id/thread", isAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const parentPost = await Post.findById(id);
    if (!parentPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    const reply = new Post({
      author: req.userId,
      content: content.trim(),
      imageUrl: imageUrl || null,
      parentId: id
    });

    await reply.save();
    await reply.populate("author", "username displayName avatar");

    res.status(201).json(reply);
  } catch (err) {
    console.error("Error adding thread reply:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// DELETE ROUTES
// =====================

// Delete post
router.delete("/:id", isAuth, deletePost);

// Delete comment
router.delete("/:id/comment/:commentId", isAuth, deleteComment);

// Remove repost
router.delete("/:id/repost", isAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const originalPost = await Post.findById(id);
    if (!originalPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user has reposted
    const userIdStr = req.userId.toString();
    const hasReposted = originalPost.reposts.some(
      userId => userId.toString() === userIdStr
    );
    if (!hasReposted) {
      return res.status(400).json({ message: "You haven't reposted this post" });
    }

    // Remove repost from original post
    originalPost.reposts = originalPost.reposts.filter(
      userId => userId.toString() !== userIdStr
    );
    await originalPost.save();

    // Delete the repost (the post with originalPost set to this post by current user)
    await Post.findOneAndDelete({ author: req.userId, originalPost: id });

    res.json({ success: true, message: "Repost removed" });
  } catch (err) {
    console.error("Error removing repost:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
