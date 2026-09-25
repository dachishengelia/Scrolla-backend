import express from "express";
import isAuth from "../middlewares/isAuth.middleware.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/settings - Get user settings
router.get("/", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "username email displayName bio location website avatar banner dateOfBirth theme accentColor notificationPreferences"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        avatar: user.avatar,
        banner: user.banner,
        dateOfBirth: user.dateOfBirth,
        theme: user.theme || "system",
        accentColor: user.accentColor || "#E8622A",
        notificationPreferences: user.notificationPreferences || {
          message: true,
          order: true,
          like: true,
          system: true
        }
      }
    });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/settings - Update user settings
router.put("/", isAuth, async (req, res) => {
  try {
    const { displayName, bio, location, website, dateOfBirth, theme, accentColor } = req.body;

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (theme !== undefined) updates.theme = theme;
    if (accentColor !== undefined) updates.accentColor = accentColor;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select("username email displayName bio location website avatar banner dateOfBirth theme accentColor notificationPreferences");

    res.json({
      message: "Settings updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        avatar: user.avatar,
        banner: user.banner,
        dateOfBirth: user.dateOfBirth,
        theme: user.theme,
        accentColor: user.accentColor,
        notificationPreferences: user.notificationPreferences
      }
    });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/settings/privacy - Update privacy settings
router.put("/privacy", isAuth, async (req, res) => {
  try {
    const { isPrivate } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { isPrivate: isPrivate } },
      { new: true }
    ).select("isPrivate");

    res.json({
      message: "Privacy settings updated",
      isPrivate: user.isPrivate
    });
  } catch (err) {
    console.error("Error updating privacy:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/settings/notifications - Update notification preferences
router.put("/notifications", isAuth, async (req, res) => {
  try {
    const { message, order, like, system } = req.body;

    const updates = {};
    if (message !== undefined) updates["notificationPreferences.message"] = message;
    if (order !== undefined) updates["notificationPreferences.order"] = order;
    if (like !== undefined) updates["notificationPreferences.like"] = like;
    if (system !== undefined) updates["notificationPreferences.system"] = system;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select("notificationPreferences");

    res.json({
      message: "Notification preferences updated",
      notificationPreferences: user.notificationPreferences
    });
  } catch (err) {
    console.error("Error updating notifications:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
