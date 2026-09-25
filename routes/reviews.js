import express from "express";
import Review from "../models/Review.js";

const router = express.Router();

// GET /api/reviews
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/reviews
router.post("/", async (req, res) => {
  try {
    const { rating, description, name } = req.body;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: "Description is required" });
    }
    if (description.length > 200) {
      return res.status(400).json({ message: "Description must be 200 characters or less" });
    }
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    const review = new Review({
      rating,
      description: description.trim(),
      name: name.trim()
    });

    await review.save();
    res.status(201).json({
      message: "Review submitted successfully",
      review
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;