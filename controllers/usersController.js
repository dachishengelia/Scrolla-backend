import User from "../models/User.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id)
      .select("username displayName bio location website avatar banner subscribers subscribing");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSubscribed = user.subscribers.some(id => id.equals(req.userId));

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
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const { displayName, bio, location, website } = req.body;

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
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload avatar
export const uploadAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ message: "Avatar URL is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar },
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
    console.error("Error uploading avatar:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload banner
export const uploadBanner = async (req, res) => {
  try {
    const { banner } = req.body;

    if (!banner) {
      return res.status(400).json({ message: "Banner URL is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { banner },
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
    console.error("Error uploading banner:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Subscribe to user
export const subscribe = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (id === req.userId) {
      return res.status(400).json({ message: "Cannot subscribe to yourself" });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(req.userId);

    // Check if already subscribed
    if (currentUser.subscribing.some(userId => userId.equals(id))) {
      return res.status(400).json({ message: "Already subscribed to this user" });
    }

    // Add to subscribing list of current user
    currentUser.subscribing.push(id);
    await currentUser.save();

    // Add to subscribers list of target user
    targetUser.subscribers.push(req.userId);
    await targetUser.save();

    // Create notification
    await Notification.create({
      recipient: id,
      sender: req.userId,
      type: "subscribe"
    });

    res.json({ message: "Subscribed successfully", subscribed: true });
  } catch (err) {
    console.error("Error subscribing:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Unsubscribe from user
export const unsubscribe = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove from subscribing list of current user
    currentUser.subscribing = currentUser.subscribing.filter(
      userId => !userId.equals(id)
    );
    await currentUser.save();

    // Remove from subscribers list of target user
    targetUser.subscribers = targetUser.subscribers.filter(
      userId => !userId.equals(req.userId)
    );
    await targetUser.save();

    res.json({ message: "Unsubscribed successfully", subscribed: false });
  } catch (err) {
    console.error("Error unsubscribing:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get subscribers list
export const getSubscribers = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

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
    console.error("Error fetching subscribers:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get subscribing list
export const getSubscribing = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

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
    console.error("Error fetching subscribing:", err);
    res.status(500).json({ message: "Server error" });
  }
};
