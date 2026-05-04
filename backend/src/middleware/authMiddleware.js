import { User } from "../models/index.js";
import { verifyAccessToken } from "../utils/tokens.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401);
      throw new Error("Access denied. No token provided.");
    }

    const token = authHeader.split(" ")[1]?.trim();
    if (!token) {
      res.status(401);
      throw new Error("Malformed authorization header.");
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select("-password -refreshTokenHash -refreshTokenExpiresAt");

    if (!user) {
      res.status(401);
      throw new Error("User no longer exists.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.status(401);
      next(new Error("Token expired. Please refresh your session."));
      return;
    }

    if (error.name === "JsonWebTokenError") {
      res.status(401);
      next(new Error("Invalid token."));
      return;
    }

    next(error);
  }
};

export default protect;
