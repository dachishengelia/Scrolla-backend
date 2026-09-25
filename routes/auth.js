import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import User from "../models/User.js";
import connectToDatabase from "../db/connectToDB.js";
import isAuth from "../middlewares/isAuth.middleware.js";

// IMPORTANT: this initializes the Google strategy
import "../strategies/google.strategy.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

/* ===========================
   CHECK USERNAME AVAILABILITY
   =========================== */
router.get("/check-username/:username", async (req, res) => {
  const { username } = req.params;
  
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  
  try {
    await connectToDatabase();
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    
    if (existingUser) {
      return res.json({ available: false });
    }
    
    res.json({ available: true });
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   JWT COOKIE HELPER
=========================== */
function sendTokenCookie(res, user) {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  return token;
}

/* ===========================
   REGISTER
=========================== */
router.post("/register", async (req, res) => {
  const { username, email, password, role, displayName, bio } = req.body;
  
  console.log("[REGISTER] Request received");
  console.log("[REGISTER] Body:", req.body);
  
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || "buyer",
    });

    const token = sendTokenCookie(res, user);

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   REFRESH TOKEN
=========================== */
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* ===========================
   FORGOT PASSWORD
=========================== */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    await connectToDatabase();
    
    const user = await User.findOne({ email });
    // Don't reveal whether user exists
    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   RESET PASSWORD
=========================== */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

/* ===========================
   LOGIN
=========================== */
router.post("/log-in", async (req, res) => {
  const { email, password } = req.body;
  
  console.log("[LOGIN] Request received");
  console.log("[LOGIN] Body:", req.body);

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    await connectToDatabase();

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = sendTokenCookie(res, user);

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   LOGOUT
=========================== */
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.status(200).json({ message: "Logged out successfully" });
});

/* ===========================
   GOOGLE LOGIN (REDIRECT)
=========================== */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

/* ===========================
   GOOGLE CALLBACK
=========================== */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    const { user } = req.user;

    const token = sendTokenCookie(res, user);

    // redirect to home with success flag (no success page)
    res.redirect(`${process.env.FRONTEND_URL}/?google=success`);
  }
);

/* ===========================
   GET CURRENT USER
=========================== */
router.get("/me", async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(
      decoded.id,
      "username email role avatar createdAt"
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

/* ===========================
   UPDATE PROFILE
=========================== */
router.patch("/profile", isAuth, async (req, res) => {
  const { username, currentPassword, newPassword, avatar } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username) user.username = username;
    if (avatar) user.avatar = avatar;

    // prevent password change for Google users
    if (currentPassword || newPassword) {
      if (!user.password) {
        return res.status(400).json({
          message: "Password change not allowed for Google accounts",
        });
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

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
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

export default router;
