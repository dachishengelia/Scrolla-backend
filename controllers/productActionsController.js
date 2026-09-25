import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { sendEmail } from "../utils/sendEmail.js";
console.log("Loaded productActionsController.js");
// Toggle like
export const toggleLike = async (req, res) => {
  console.log("=======Toggling like for product:", req.params.id, "by user:", req.user._id);
  try {
    const userId = req.user._id;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const alreadyLiked = product.likes.some((id) => id.equals(userId));
    const alreadyDisliked = product.dislikes.some((id) => id.equals(userId));

    if (alreadyLiked) {
      // Remove like
      product.likes = product.likes.filter((id) => !id.equals(userId));
    } else {
      // Add like and remove dislike if present
      product.likes.push(userId);
      if (alreadyDisliked) {
        product.dislikes = product.dislikes.filter((id) => !id.equals(userId));
      }
    }

    await product.save();
    console.log("=========alreadyliked", alreadyLiked)

    // Send email to seller if liked
    // if (!alreadyLiked) {
    //   console.log("Attempting to send like email for product:", product.name);
    //   try {
    //     const seller = await User.findById(product.sellerId);
    //     console.log("Seller found:", seller ? seller._id : 'null', "Email:", seller?.email);
    //     if (seller && seller.email){
    //       console.log("Sending like email to:", seller.email);
    //       await sendEmail({
    //         to: seller.email,
    //         subject: "Your product received a like!",
    //         html: `
    //           <h2>Great news!</h2>
    //           <p>Your product <strong>${product.name}</strong> has been liked by a user.</p>
    //           <p>Keep up the good work!</p>
    //         `,
    //       });
    //       console.log("Email sent successfully");
    //     } else {
    //       console.log("Seller not found or no email, skipping email");
    //     }
    //   } catch (emailError) {
    //     console.error("Error sending like email:", emailError);
    //     // Continue without failing the request
    //   }
    // }

    return res.json({
      success: true,
      likesCount: product.likes.length,
      dislikesCount: product.dislikes.length,
      liked: !alreadyLiked,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Toggle dislike
export const toggleDislike = async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const alreadyLiked = product.likes.some((id) => id.equals(userId));
    const alreadyDisliked = product.dislikes.some((id) => id.equals(userId));

    if (alreadyDisliked) {
      // Remove dislike
      product.dislikes = product.dislikes.filter((id) => !id.equals(userId));
    } else {
      // Add dislike and remove like if present
      product.dislikes.push(userId);
      if (alreadyLiked) {
        product.likes = product.likes.filter((id) => !id.equals(userId));
      }
    }

    await product.save();

    return res.json({
      success: true,
      likesCount: product.likes.length,
      dislikesCount: product.dislikes.length,
      disliked: !alreadyDisliked,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Add comment
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text required" });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const comment = {
      userId: req.user._id,
      username: req.user.username,  // Ensure this is the username, not email
      text: text.trim(),
    };

    product.comments.push(comment);
    await product.save();

    return res.json({
      success: true,
      comments: product.comments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const comment = product.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (!comment.userId.equals(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // Fix: Use pull() to remove the subdocument
    product.comments.pull(req.params.commentId);
    await product.save();

    return res.json({ success: true, comments: product.comments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Toggle favorite
export const toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const productId = req.params.id;
    const already = user.favorites?.some((id) => id.equals(productId));

    if (already) {
      user.favorites = user.favorites.filter((id) => !id.equals(productId));
    } else {
      if (!user.favorites) user.favorites = [];
      user.favorites.push(productId);
    }

    await user.save();

    return res.json({ success: true, favorited: !already, favorites: user.favorites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Helper function to normalize product with imageUrl
const normalizeProduct = (product) => {
  if (!product) return null;
  const productObj = product.toObject ? product.toObject() : product;
  if (product.images && product.images.length > 0) {
    const mainImage = product.images.find(img => img.isMain) || product.images[0];
    productObj.imageUrl = mainImage.url;
  } else {
    productObj.imageUrl = null;
  }
  return productObj;
};

// Get all favorite products of logged-in user
export const getUserFavorites = async (req, res) => {
  try {
    console.log("Fetching favorites for user:", req.userId); // Debugging log
    const user = await User.findById(req.userId).populate({
      path: "favorites",
      populate: { path: "sellerId", select: "username email" }
    });
    if (!user) {
      console.error("User not found");
      return res.status(404).json({ message: "User not found" });
    }
    
    // Normalize each product to include imageUrl
    const favorites = (user.favorites || []).map(normalizeProduct);
    res.status(200).json({ favorites });
  } catch (err) {
    console.error("Error fetching user favorites:", err); // Debugging log
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
};

// Add a product to favorites
export const addToFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const productId = req.body.productId;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Valid product ID required" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const exists = user.favorites?.some((id) => id.equals(productId));
    if (!exists) {
      if (!user.favorites) user.favorites = [];
      user.favorites.push(productId);
      await user.save();
    }

    await user.populate("favorites");
    res.json({ favorites: user.favorites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove a product from favorites
export const removeFromFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    user.favorites = user.favorites?.filter((id) => !id.equals(productId)) || [];
    await user.save();

    await user.populate("favorites");
    res.json({ favorites: user.favorites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
