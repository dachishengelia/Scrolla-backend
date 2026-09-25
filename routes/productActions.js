import express from "express";
import {
  toggleLike,
  toggleDislike,
  addComment,
  deleteComment,
  toggleFavorite,
  getUserFavorites,
  addToFavorites,
  removeFromFavorites,
} from "../controllers/productActionsController.js";

import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();


router.post("/:id/like", isAuth, toggleLike);

router.post("/:id/dislike", isAuth, toggleDislike);

router.post("/:id/comment", isAuth, addComment);


router.delete("/:id/comment/:commentId", isAuth, deleteComment);


router.post("/:id/favorite", isAuth, toggleFavorite);


router.get("/my/favorites", isAuth, getUserFavorites);

router.post("/favorites/add", isAuth, addToFavorites);

router.delete("/favorites/remove/:productId", isAuth, removeFromFavorites);

router.get("/favorites", isAuth, getUserFavorites);

export default router;
