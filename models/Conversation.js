import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Ensure unique pair of participants
ConversationSchema.index({ participants: 1 }, { unique: true });
ConversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model("Conversation", ConversationSchema);
