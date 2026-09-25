import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  description: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;