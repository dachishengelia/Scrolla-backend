import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxLength: 500 },
  media: { type: mongoose.Schema.Types.Mixed, default: [] },
  imageUrl: { type: String },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
  originalPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
PostSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for feed queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ content: "text" }); // For text search

export default mongoose.model("Post", PostSchema);
