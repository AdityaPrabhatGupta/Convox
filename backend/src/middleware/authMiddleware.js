import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined in environment');

const protect = async (req, res, next) => {
    try {
        // 1. Check Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        // 2. Extract and sanitize token
        const token = authHeader.split(' ')[1]?.trim();
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Malformed authorization header.',
            });
        }

        // 3. Verify token — TokenExpiredError before JsonWebTokenError
        const decoded = jwt.verify(token, JWT_SECRET);

        // 4. Fetch user (exclude password)
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists.',
            });
        }

        // 5. Attach user and continue
        req.user = user;
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please log in again.',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error.',
        });
    }
};

export default protect;