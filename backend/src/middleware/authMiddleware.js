import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req,res,next) =>{
    try {
    // 1. Check if Authorization header exists

    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({
            success:false,
            message:"Access denied. No Token Provided.",
        });
    }

    //2. Extract token from "Bearer <token>"
     
    const token =authHeader.split(" ")[1];

    //3. Verify token using JWT secret

    const decoded =jwt.verify(token, process.env.JWT_SECRET);

    //4. Fetch user from DB using decoded ID (exclude password)
    
    const user = await User.findById(decoded.id).select("-password");
    
    if(!user){
        return res.status(401).json({
            success:false,
            message:"User no longer Exists ."
        });
    }

    //5. Attach user to request object

    req.user = user;

    // 6. Pass control to the next middleware/route

    next();

    } catch (error) {
        console.error("Auth Middleware Error:",error.message);
        
        if(error.name === "JsonWebTokenError"){
            return res.status(401).json({
                success:false,
                message:"Invalid Token",
            });
        }

        if(error.name === "TokenExpiredError"){
            return res.status(401).json({
                success:false,
                message:"Token Expired !! ,Please Login Again",
            });
        }
        res.status(500).json({
            success:false,
            message:"Server Error",
        });
    }
};

export default protect;