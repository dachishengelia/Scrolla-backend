import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();

// GET /api/trending - Get trending hashtags
router.get("/", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get all posts from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Aggregate to find hashtags and their counts
    const posts = await Post.find({
      createdAt: { $gte: sevenDaysAgo },
      content: { $regex: /#\w+/g }
    }).select("content likes createdAt").limit(500);
    
    // Extract hashtags and count
    const hashtagCounts = {};
    posts.forEach(post => {
      const hashtags = post.content.match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        const normalizedTag = tag.toLowerCase();
        if (!hashtagCounts[normalizedTag]) {
          hashtagCounts[normalizedTag] = { tag: normalizedTag, count: 0, likes: 0 };
        }
        hashtagCounts[normalizedTag].count += 1;
        hashtagCounts[normalizedTag].likes += post.likes.length;
      });
    });
    
    // Sort by a score (likes + posts count)
    const trending = Object.values(hashtagCounts)
      .sort((a, b) => (b.likes + b.count * 2) - (a.likes + a.count * 2))
      .slice(0, parseInt(limit));
    
    res.json({ trending });
  } catch (err) {
    console.error("Error fetching trending:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
