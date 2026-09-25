import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxLength: 500 },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Index for post comments query
CommentSchema.index({ postId: 1, createdAt: -1 });

export default mongoose.model("Comment", CommentSchema);
