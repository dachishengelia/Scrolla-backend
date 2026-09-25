import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

// Helper function to populate post with author info
const populatePost = (post) => {
  return {
    _id: post._id,
    content: post.content,
    imageUrl: post.imageUrl,
    likesCount: post.likes.length,
    commentsCount: post.comments.length,
    likedByCurrentUser: false,
    author: {
      _id: post.author._id,
      username: post.author.username,
      displayName: post.author.displayName || post.author.username,
      avatar: post.author.avatar
    },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
};

// Get feed posts (paginated)
export const getFeedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get posts from users that current user subscribes to, plus own posts
    const subscribingIds = req.user.subscribing || [];
    const authorIds = [...subscribingIds, req.userId];

    const posts = await Post.find({ author: { $in: authorIds } })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ author: { $in: authorIds } });

    const formattedPosts = posts.map(post => {
      const postObj = post.toObject();
      postObj.likedByCurrentUser = post.likes.some(id => id.equals(req.userId));
      return populatePost(postObj);
    });

    res.json({
      posts: formattedPosts,
      page,
      hasMore: skip + limit < totalPosts
    });
  } catch (err) {
    console.error("Error fetching feed posts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create new post
export const createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    if (content.length > 500) {
      return res.status(400).json({ message: "Content must be 500 characters or less" });
    }

    const post = new Post({
      author: req.userId,
      content: content.trim(),
      imageUrl: imageUrl || null
    });

    await post.save();
    await post.populate("author", "username displayName avatar");

    res.status(201).json(populatePost(post.toObject()));
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single post
export const getPost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id)
      .populate("author", "username displayName avatar");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const postObj = post.toObject();
    postObj.likedByCurrentUser = post.likes.some(id => id.equals(req.userId));

    res.json(populatePost(postObj));
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete post
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (!post.author.equals(req.userId) && req.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    // Delete associated comments
    await Comment.deleteMany({ postId: id });

    // Delete notifications related to this post
    await Notification.deleteMany({ postId: id });

    await post.deleteOne();

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Toggle like on post
export const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likes.some(id => id.equals(req.userId));

    if (alreadyLiked) {
      post.likes = post.likes.filter(id => !id.equals(req.userId));
    } else {
      post.likes.push(req.userId);

      // Create notification (not for self-likes)
      if (!post.author.equals(req.userId)) {
        await Notification.create({
          recipient: post.author,
          sender: req.userId,
          type: "like",
          postId: post._id
        });
      }
    }

    await post.save();

    res.json({
      success: true,
      likesCount: post.likes.length,
      likedByCurrentUser: !alreadyLiked
    });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add comment to post
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    if (content.length > 500) {
      return res.status(400).json({ message: "Comment must be 500 characters or less" });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = new Comment({
      postId: id,
      author: req.userId,
      content: content.trim(),
      imageUrl: imageUrl || null
    });

    await comment.save();
    post.comments.push(comment._id);
    await post.save();

    await comment.populate("author", "username displayName avatar");

    // Create notification (not for self-comments)
    if (!post.author.equals(req.userId)) {
      await Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: "comment",
        postId: post._id
      });
    }

    res.status(201).json({
      _id: comment._id,
      content: comment.content,
      imageUrl: comment.imageUrl,
      author: comment.author,
      createdAt: comment.createdAt
    });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get comments for post
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const comments = await Comment.find({ postId: id })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalComments = await Comment.countDocuments({ postId: id });

    res.json({
      comments,
      page,
      hasMore: skip + limit < totalComments
    });
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check ownership
    if (!comment.author.equals(req.userId) && req.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    await comment.deleteOne();

    // Remove from post's comments array
    await Post.findByIdAndUpdate(id, {
      $pull: { comments: commentId }
    });

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Search posts
export const searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!q || !q.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const posts = await Post.find(
      { $text: { $search: q.trim() } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" }, createdAt: -1 })
      .populate("author", "username displayName avatar")
      .skip(skip)
      .limit(limit);

    const formattedPosts = posts.map(post => {
      const postObj = post.toObject();
      postObj.likedByCurrentUser = post.likes.some(id => id.equals(req.userId));
      return populatePost(postObj);
    });

    res.json({ posts: formattedPosts, page, hasMore: posts.length === limit });
  } catch (err) {
    console.error("Error searching posts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user's posts
export const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const posts = await Post.find({ author: id })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ author: id });

    const formattedPosts = posts.map(post => {
      const postObj = post.toObject();
      postObj.likedByCurrentUser = post.likes.some(id => id.equals(req.userId));
      return populatePost(postObj);
    });

    res.json({
      posts: formattedPosts,
      page,
      hasMore: skip + limit < totalPosts
    });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ message: "Server error" });
  }
};
