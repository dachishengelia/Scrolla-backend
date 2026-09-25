import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();

// GET /api/conversations - Get all conversations for current user
router.get("/conversations", isAuth, async (req, res) => {
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

// GET /api/messages/:conversationId - Get messages in a conversation
router.get("/:conversationId", isAuth, async (req, res) => {
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

// POST /api/messages/:conversationId - Send a message in a conversation
router.post("/:conversationId", isAuth, async (req, res) => {
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

// POST /api/conversations - Create a new conversation
router.post("/conversations", isAuth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.userId;

    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ message: "Invalid recipient ID" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    if (recipientId === senderId) {
      return res.status(400).json({ message: "Cannot create conversation with yourself" });
    }

    // Check for existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    }).populate("participants", "username displayName avatar");

    if (conversation) {
      return res.json({ conversation });
    }

    // Create new conversation
    conversation = new Conversation({
      participants: [senderId, recipientId]
    });
    await conversation.save();
    await conversation.populate("participants", "username displayName avatar");

    const otherParticipant = conversation.participants.find(
      p => p._id.toString() !== req.userId
    );

    res.status(201).json({
      conversation: {
        _id: conversation._id,
        participants: conversation.participants,
        participant: otherParticipant ? {
          _id: otherParticipant._id,
          username: otherParticipant.username,
          displayName: otherParticipant.displayName || otherParticipant.username,
          avatar: otherParticipant.avatar
        } : null,
        lastMessage: null,
        lastMessageAt: conversation.lastMessageAt
      }
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/messages - Start a new conversation or get existing one
router.post("/", isAuth, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.userId;

    // Validate required fields
    if (!recipientId || !content) {
      return res.status(400).json({ message: "recipientId and content are required" });
    }

    // Validate recipientId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ message: "Invalid recipient ID" });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    // Prevent sending message to self
    if (recipientId === senderId) {
      return res.status(400).json({ message: "Cannot send message to yourself" });
    }

    // Check for existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    });

    // Create new conversation if doesn't exist
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId]
      });
      await conversation.save();
    }

    // Create message
    const message = new Message({
      conversationId: conversation._id,
      senderId,
      recipientId,
      content: content.trim()
    });

    await message.save();

    // Update conversation with last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = Date.now();
    await conversation.save();

    await message.populate("senderId", "username displayName avatar");

    res.status(201).json({
      conversationId: conversation._id,
      message
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/messages/dm/:userId - Get or create conversation with specific user
router.get("/dm/:userId", isAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (userId === req.userId) {
      return res.status(400).json({ message: "Cannot message yourself" });
    }

    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, userId] }
    })
      .populate("participants", "username displayName avatar")
      .populate("lastMessage");

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [req.userId, userId]
      });
      await conversation.save();
      await conversation.populate("participants", "username displayName avatar");
    }

    const otherParticipant = conversation.participants.find(
      p => p._id.toString() !== req.userId
    );

    res.json({
      conversation: {
        _id: conversation._id,
        participant: otherParticipant ? {
          _id: otherParticipant._id,
          username: otherParticipant.username,
          displayName: otherParticipant.displayName || otherParticipant.username,
          avatar: otherParticipant.avatar
        } : null,
        lastMessage: conversation.lastMessage ? {
          content: conversation.lastMessage.content,
          senderId: conversation.lastMessage.senderId,
          createdAt: conversation.lastMessage.createdAt
        } : null,
        lastMessageAt: conversation.lastMessageAt
      }
    });
  } catch (error) {
    console.error("Error getting DM conversation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
