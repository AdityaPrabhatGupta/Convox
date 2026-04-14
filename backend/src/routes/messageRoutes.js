import express from 'express';
import { sendMessage ,allMessages } from '../controllers/messageController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// All message routes are protected
router.post('/', protect, sendMessage);
router.route("/:chatId").get(protect, allMessages);

export default router;