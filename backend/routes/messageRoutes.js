import express from 'express';
import { sendMessage ,allMessages } from '../src/controllers/messageController.js';
import protect from '../src/middleware/authMiddleware.js';

const router = express.Router();

// All message routes are protected
router.post('/', protect, sendMessage);
router.route("/:chatId").get(protect, allMessages);

export default router;