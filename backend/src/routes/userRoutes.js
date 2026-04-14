import express from 'express';
import { loginUser, registerUser , getUserProfile } from '../controllers/authController.js';
import { searchUsers } from "../controllers/userController.js";
import protect from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/register',registerUser);
router.post('/login', loginUser);      

router.get("/search", protect, searchUsers);
router.get('/profile', protect, getUserProfile);

export default router;
