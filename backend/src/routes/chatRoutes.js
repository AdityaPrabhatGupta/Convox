// routes/chatRoutes.js
import express from "express";
import { createOrFetchChat ,fetchChats } from "../controllers/chatController.js";
import  protect  from "../middleware/authMiddleware.js"; 
const router = express.Router();

// POST /api/chat
router.post("/", protect, createOrFetchChat);
router.get("/", protect, fetchChats);    

export default router;