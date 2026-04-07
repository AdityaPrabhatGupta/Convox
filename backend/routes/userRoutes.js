import express from 'express';
import { loginUser, registerUser , getUserProfile } from '../src/controllers/authController.js';
import protect from '../src/middleware/authMiddleware.js';


const router = express.Router();

router.post('/register',registerUser);
router.post('/login', loginUser);      

router.get('/profile', protect, getUserProfile);

export default router;