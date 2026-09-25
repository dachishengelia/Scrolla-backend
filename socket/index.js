import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Store online users: Map<userId, socketId>
const onlineUsers = new Map();

export function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Handle typing indicator
    socket.on("typing", (data) => {
      const { conversationId, recipientId } = data;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit("userTyping", {
          conversationId,
          userId: socket.userId,
          isTyping: true
        });
      }
    });

    socket.on("stopTyping", (data) => {
      const { conversationId, recipientId } = data;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit("userTyping", {
          conversationId,
          userId: socket.userId,
          isTyping: false
        });
      }
    });

    // Handle message read receipts
    socket.on("messageRead", (data) => {
      const { conversationId, messageId, recipientId } = data;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit("messageRead", {
          conversationId,
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      }
    });

    // Handle user online status
    socket.on("getOnlineStatus", (userIds) => {
      const onlineStatus = {};
      userIds.forEach(userId => {
        onlineStatus[userId] = onlineUsers.has(userId);
      });
      socket.emit("onlineStatus", onlineStatus);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
    });
  });

  return io;
}

// Helper function to send notification to a user
export function sendNotification(io, userId, notification) {
  io.to(`user:${userId}`).emit("notification", notification);
}

// Helper function to send new message to a user
export function sendMessage(io, userId, message) {
  io.to(`user:${userId}`).emit("newMessage", message);
}

// Helper function to broadcast new post to followers
export function broadcastNewPost(io, authorId, post) {
  // This would require fetching followers - simplified for now
  io.emit("newPost", post);
}
