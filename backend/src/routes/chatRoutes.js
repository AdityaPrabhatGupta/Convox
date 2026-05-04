// routes/chatRoutes.js
import express from "express";
import { createOrFetchChat ,fetchChats, removeDirectChat } from "../controllers/chatController.js";
import  protect  from "../middleware/authMiddleware.js"; 
const router = express.Router();

// POST /api/chat
router.post("/", protect, createOrFetchChat);
router.get("/", protect, fetchChats);    
router.delete("/:chatId", protect, removeDirectChat);

export default router;
