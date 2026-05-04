import express from 'express';
import {
  loginUser,
  registerUser,
  getUserProfile,
  googleAuth,
  googleCallback,
  logoutUser,
  refreshSession,
} from '../controllers/authController.js';
import { blockUser, searchUsers, updateUserProfile } from "../controllers/userController.js";
import protect from '../middleware/authMiddleware.js';
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Standard auth
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/refresh', authLimiter, refreshSession);
router.post('/logout', logoutUser);

// Google OAuth
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// Protected routes
router.get("/search", protect, searchUsers);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/block/:userId', protect, blockUser);

export default router;
