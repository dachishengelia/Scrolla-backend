import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();

// GET /api/explore - Explore posts, people, media
router.get("/", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type = "all" } = req.query;
    const skip = (page - 1) * limit;

    let posts;
    let total;

    if (type === "media") {
      // Only posts with images
      posts = await Post.find({ imageUrl: { $exists: true, $ne: null } })
        .populate("author", "username displayName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      total = await Post.countDocuments({ imageUrl: { $exists: true, $ne: null } });
    } else if (type === "people") {
      // Suggested users to follow
      const currentUser = await User.findById(req.userId);
      const followingIds = currentUser.subscribing || [];
      followingIds.push(req.userId);

      users = await User.find({ _id: { $nin: followingIds } })
        .select("username displayName avatar bio")
        .limit(parseInt(limit));

      return res.json({
        users,
        page: parseInt(page),
        totalPages: Math.ceil(users.length / limit),
        total: users.length
      });
    } else {
      // All posts (feed)
      posts = await Post.find()
        .populate("author", "username displayName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      total = await Post.countDocuments();
    }

    // Format posts with counts
    const formattedPosts = posts.map(post => ({
      _id: post._id,
      content: post.content,
      imageUrl: post.imageUrl,
      author: {
        _id: post.author._id,
        username: post.author.username,
        displayName: post.author.displayName || post.author.username,
        avatar: post.author.avatar
      },
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      repostsCount: post.reposts ? post.reposts.length : 0,
      likedByCurrentUser: post.likes.some(id => id.equals(req.userId)),
      bookmarkedByCurrentUser: post.bookmarks ? post.bookmarks.some(id => id.equals(req.userId)) : false,
      createdAt: post.createdAt
    }));

    res.json({
      posts: formattedPosts,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Error fetching explore:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/explore/hashtags/:tag - Get posts by hashtag
router.get("/hashtags/:tag", isAuth, async (req, res) => {
  try {
    const { tag } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ content: { $regex: `#${tag}\\b`, $options: "i" } })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({ content: { $regex: `#${tag}\\b`, $options: "i" } });

    const formattedPosts = posts.map(post => ({
      _id: post._id,
      content: post.content,
      imageUrl: post.imageUrl,
      author: {
        _id: post.author._id,
        username: post.author.username,
        displayName: post.author.displayName || post.author.username,
        avatar: post.author.avatar
      },
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      likedByCurrentUser: post.likes.some(id => id.equals(req.userId)),
      createdAt: post.createdAt
    }));

    res.json({
      posts: formattedPosts,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Error fetching hashtag posts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/explore/mentions/:username - Get posts mentioning user
router.get("/mentions/:username", isAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ content: { $regex: `@${username}\\b`, $options: "i" } })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({ content: { $regex: `@${username}\\b`, $options: "i" } });

    const formattedPosts = posts.map(post => ({
      _id: post._id,
      content: post.content,
      imageUrl: post.imageUrl,
      author: {
        _id: post.author._id,
        username: post.author.username,
        displayName: post.author.displayName || post.author.username,
        avatar: post.author.avatar
      },
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      likedByCurrentUser: post.likes.some(id => id.equals(req.userId)),
      createdAt: post.createdAt
    }));

    res.json({
      posts: formattedPosts,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error("Error fetching mention posts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
