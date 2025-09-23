import express from "express";
import { register, login } from "../controllers/authController.js";
import { getPosts } from "../controllers/postController.js";

const router = express.Router();

// Registro y login
router.post("/auth/register", register);
router.post("/auth/login", login);

// Ver posts públicos
router.get("/posts", getPosts);

export default router;
