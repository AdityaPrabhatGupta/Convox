import { User } from "../models/index.js";
import logger from "../config/logger.js";
import { verifyAccessToken } from "../utils/tokens.js";

export default function socketAuth() {
  return async (socket, next) => {
    try {
      const bearerToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      const rawToken = String(bearerToken || "").replace(/^Bearer\s+/i, "").trim();

      if (!rawToken) {
        const error = new Error("Socket authentication required");
        error.data = { code: "SOCKET_AUTH_REQUIRED" };
        next(error);
        return;
      }

      const decoded = verifyAccessToken(rawToken);
      const user = await User.findById(decoded.id).select("-password -refreshTokenHash -refreshTokenExpiresAt");

      if (!user) {
        const error = new Error("Socket user no longer exists");
        error.data = { code: "SOCKET_USER_NOT_FOUND" };
        next(error);
        return;
      }

      socket.userId = String(user._id);
      socket.user = user;
      next();
    } catch (error) {
      logger.warn("Socket authentication failed", { error: error.message });
      const authError = new Error("Invalid socket token");
      authError.data = { code: "SOCKET_INVALID_TOKEN" };
      next(authError);
    }
  };
}
