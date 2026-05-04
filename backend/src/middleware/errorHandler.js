import logger from "../config/logger.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const inferredStatus =
    error.statusCode ||
    error.status ||
    (res.statusCode >= 400 ? res.statusCode : null) ||
    (error.name === "ValidationError" ? 400 : 500);
  const statusCode = inferredStatus >= 400 ? inferredStatus : 500;
  const safeMessage =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "Internal server error";

  logger.error("Request failed", {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error.message,
    stack: error.stack,
    userId: req.user?._id ? String(req.user._id) : null,
  });

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    ...(process.env.NODE_ENV !== "production" && error.code ? { code: error.code } : {}),
  });
}
