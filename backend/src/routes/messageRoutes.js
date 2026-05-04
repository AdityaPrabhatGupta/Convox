import express from 'express';
import {
  allMessages,
  clearChatMessages,
  deleteForEveryone,
  deleteForMe,
  editMessage,
  forwardMessages,
  sendMessage,
  uploadMedia,
  togglePinMessage,
  toggleReaction,
} from '../controllers/messageController.js';
import protect from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// All message routes are protected
router.post('/', protect, sendMessage);
router.post(
  '/upload',
  protect,
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      error.statusCode = 400;
      next(error);
    });
  },
  uploadMedia,
);
router.post('/forward', protect, forwardMessages);
router.delete('/chat/:chatId/clear', protect, clearChatMessages);
router.patch('/:messageId/react', protect, toggleReaction);
router.patch('/:messageId/pin', protect, togglePinMessage);
router.patch('/:messageId/edit', protect, editMessage);
router.patch('/:messageId/delete-for-me', protect, deleteForMe);
router.patch('/:messageId/delete-for-everyone', protect, deleteForEveryone);
router.route("/:chatId").get(protect, allMessages);

export default router;
