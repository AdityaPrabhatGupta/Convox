import "dotenv/config";
import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import helmet from "helmet";
import connectDB from './config/db.js';
import { getDatabaseHealth } from "./config/db.js";
// import { corsOptions } from "./config/cors.js";
import logger from "./config/logger.js";
import { isRedisReady } from "./config/redis.js";
import {
    userRoutes,
    messageRoutes,
    chatRoutes,
    chatRequestRoutes,
    groupRoutes,
} from "./routes/index.js";
import { assistantRouter, aiRouter } from "./routes/assistantRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import requestLogger from "./middleware/requestLogger.js";
import { apiLimiter } from "./middleware/rateLimit.js";

const app = express();

connectDB();

//CORS
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cookieParser());
app.use(requestLogger);

//Body Parsers
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

//Health Check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Convox backend is healthy",
        environment: process.env.NODE_ENV,
        uptimeSeconds: Math.round(process.uptime()),
        database: getDatabaseHealth(),
        redis: { ready: isRedisReady() },
    });
});

app.use("/api", apiLimiter);

//Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/assistant", assistantRouter);
app.use("/api/ai", aiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

logger.info("Express application initialized");

export default app;
