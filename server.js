// import dotenv from "dotenv";
// dotenv.config();

// import checkoutRoutes from "./checkout.js"

// import express from "express";
// const app = express();
// import productActionsRoutes from "./routes/productActions.js";
// import mongoose from "mongoose";
// import cookieParser from "cookie-parser";
// import cors from "cors";

// import authRoutes from "./routes/auth.js";
// import adminRoutes from "./routes/admin.js";
// import SellerRoutes from "./routes/seller.js";
// import CartRoutes from "./routes/CartRoutes.js";
// import productRoutes from "./routes/Product.js";
// import connectToDb from "./db/connectToDB.js";

// const allowedOrigins = [
//   process.env.FRONTEND_URL,
//   process.env.FRONTEND_VERCEL_URL,
//   "http://localhost:5173",
//   "https://re-style-backend.vercel.app"
// ];

// // app.use(cors({origin: [process.env.FRONTEND_URL, process.env.FRONTEND_VERCEL_URL], credentials: true}));
// // app.use(cors({}));
// // const allowedOrigins = [
// //   process.env.FRONTEND_URL,        // e.g., http://localhost:5173
// //   process.env.FRONTEND_VERCEL_URL  // e.g., https://re-style-frontend.vercel.app
// // ];

// app.use(cors({
//   origin: function(origin, callback){
//     // allow requests with no origin (like mobile apps or curl)
//     if(!origin) return callback(null, true);

//     if(allowedOrigins.indexOf(origin) !== -1){
//       callback(null, true);
//     } else {
//       callback(new Error("CORS not allowed for this origin"), false);
//     }
//   },
//   credentials: true,
//   methods: ["GET","POST","PUT","DELETE","OPTIONS"]
// }));

// // Handle preflight requests
// app.options("*", cors({
//   origin: allowedOrigins,
//   credentials: true,
//   methods: ["GET","POST","PUT","DELETE","OPTIONS"]
// }));

// app.use(express.json());
// app.use(cookieParser());
// app.use(express.static("public"));

// console.log("Frontend URL:", process.env.FRONTEND_URL);


// app.use("/api/auth", authRoutes);
// app.use("/api/product-actions", productActionsRoutes);
// app.use("/admin", adminRoutes);
// app.use("/seller", SellerRoutes);
// app.use("/api/cart", CartRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/checkout", checkoutRoutes);
// app.use("/api/checkout", Routes);
// app.get("/", (req, res) => {
//   res.send(`
//     <div style="background-color: white; color: black; height: 100vh; display: flex; justify-content: center; align-items: center; font-size: 30px; font-weight: bold;">
//       Backend is working.
//     </div>
//   `);
// });

// const PORT = process.env.PORT || 3000;

// connectToDb().then(() => {
//   app.listen(PORT, () => console.log(`Server running locally on port ${PORT}`));
// });

import dotenv from "dotenv";
dotenv.config();

import express from "express";
const app = express();
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "./strategies/google.strategy.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import SellerRoutes from "./routes/seller.js";
import CartRoutes from "./routes/CartRoutes.js";
import productRoutes from "./routes/Product.js";
import productActionsRoutes from "./routes/productActions.js";
import checkoutRoutes from "./routes/checkout.js";
import usersRoutes from "./routes/users.js";
import profileRoutes from "./routes/profile.js";
import statsRoutes from "./routes/stats.js";
import reviewsRoutes from "./routes/reviews.js";
import favoritesRoutes from "./routes/favorites.js";
import messagesRoutes from "./routes/messages.js";
import conversationsRoutes from "./routes/conversations.js";
import postsRoutes from "./routes/posts.js";
import notificationsRoutes from "./routes/notifications.js";
import trendingRoutes from "./routes/trending.js";
import exploreRoutes from "./routes/explore.js";
import settingsRoutes from "./routes/settings.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketIO } from "./socket/index.js";
import connectToDb from "./db/connectToDB.js";
import isAuth from "./middlewares/isAuth.middleware.js";

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_VERCEL_URL,
  "http://localhost:5173",
  "https://restyle-backend123.vercel.app"
];

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) !== -1){
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for this origin"), false);
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"]
}));

// Handle preflight requests
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"]
}));

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/checkout/webhook') {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(cookieParser());
app.use(express.static("public"));
app.use(passport.initialize());

console.log("Frontend URL:", process.env.FRONTEND_URL);

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/product-actions", productActionsRoutes);
app.use("/admin", adminRoutes);
app.use("/seller", SellerRoutes);
app.use("/api/cart", CartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/posts", postsRoutes);

// Alias for /api/feed -> /api/posts/feed
import { getFeedPosts, getUserPosts } from "./controllers/postsController.js";
app.get("/api/feed", isAuth, getFeedPosts);

// Alias for /api/users/:id/posts -> /api/posts/user/:id
app.get("/api/users/:id/posts", isAuth, getUserPosts);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/", (req, res) => {
  res.send(`
    <div style="background-color: white; color: black; height: 100vh; display: flex; justify-content: center; align-items: center; font-size: 30px; font-weight: bold;">
      Backend is working.
    </div>
  `);
});

const PORT = process.env.PORT || 3001;

let server;

const startServer = async () => {
  try {
    await connectToDb();
    server = createServer(app);
    
    // Setup Socket.IO
    setupSocketIO(server);
    
    server.listen(PORT, () => {
      console.log(`Server running locally on port ${PORT}`);
    });
    
    return server;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error("Error during server shutdown:", err);
        process.exit(1);
      }
      console.log("HTTP server closed.");
      
      // Close database connection
      await mongoose.connection.close();
      console.log("Mongoose connection closed");
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});
