import express from "express";
import { createPost, toggleLike, addComment } from "../controllers/postController.js";
import { sendMessage, getMessages } from "../controllers/chatController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";


const router = express.Router();


// Posts privados
router.post("/posts", verifyToken, upload.single("image"), createPost);
router.patch("/posts/like/:id", verifyToken, toggleLike);
router.post("/posts/comment/:id", verifyToken, addComment);

// Chat privado
router.post("/chat", verifyToken, sendMessage);
router.get("/chat", verifyToken, getMessages);

export default router;
