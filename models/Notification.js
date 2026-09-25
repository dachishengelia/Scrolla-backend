import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { 
    type: String, 
    enum: ["like", "comment", "subscribe"], 
    required: true 
  },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Index for user notifications
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, read: 1 });

export default mongoose.model("Notification", NotificationSchema);
