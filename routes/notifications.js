import express from "express";
import isAuth from "../middlewares/isAuth.middleware.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from "../controllers/notificationsController.js";

const router = express.Router();

router.get("/", isAuth, getNotifications);
router.patch("/:id/read", isAuth, markAsRead);
router.post("/read-all", isAuth, markAllAsRead);
router.delete("/:id", isAuth, deleteNotification);

export default router;
