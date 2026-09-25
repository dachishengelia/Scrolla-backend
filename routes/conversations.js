import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();

// GET /api/conversations - Get all conversations for current user
router.get("/", isAuth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId
    })
      .populate("participants", "username displayName avatar")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(
        p => p._id.toString() !== req.userId
      );

      return {
        _id: conv._id,
        participant: otherParticipant ? {
          _id: otherParticipant._id,
          username: otherParticipant.username,
          displayName: otherParticipant.displayName || otherParticipant.username,
          avatar: otherParticipant.avatar
        } : null,
        lastMessage: conv.lastMessage ? {
          content: conv.lastMessage.content,
          senderId: conv.lastMessage.senderId,
          createdAt: conv.lastMessage.createdAt
        } : null,
        lastMessageAt: conv.lastMessageAt
      };
    });

    res.json({ conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/conversations/:conversationId/messages - Get messages in a conversation
router.get("/:conversationId/messages", isAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if user is participant
    if (!conversation.participants.some(p => p.toString() === req.userId)) {
      return res.status(403).json({ message: "Not authorized to view this conversation" });
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId", "username displayName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments({ conversationId });

    res.json({
      messages: messages.reverse(),
      page,
      hasMore: skip + limit < totalMessages
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/conversations/:conversationId/messages - Send a message in a conversation
router.post("/:conversationId/messages", isAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if user is participant
    if (!conversation.participants.some(p => p.toString() === req.userId)) {
      return res.status(403).json({ message: "Not authorized to send messages in this conversation" });
    }

    // Create message
    const message = new Message({
      conversationId,
      senderId: req.userId,
      recipientId: conversation.participants.find(p => p.toString() !== req.userId),
      content: content.trim()
    });

    await message.save();

    // Update conversation with last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = Date.now();
    await conversation.save();

    await message.populate("senderId", "username displayName avatar");

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
