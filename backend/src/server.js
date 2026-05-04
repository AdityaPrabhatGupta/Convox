import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { initializeSocket, setIoInstance } from "./socket/index.js";
import { validateRequiredEnv } from "./config/validateEnv.js";
import {
  seedAssistantUser,
  syncAssistantChatsForAllUsers,
} from "./services/assistantSeeder.js";
// import { corsOptions, getAllowedOrigins } from "./config/cors.js";
import logger from "./config/logger.js";
import { connectRedis, disconnectRedis, initializeSocketRedisAdapter } from "./config/redis.js";
import socketAuth from "./socket/socketAuth.js";

const PORT = process.env.PORT || 5000;
validateRequiredEnv();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", process.env.CLIENT_URL],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.use(socketAuth());
setIoInstance(io);
initializeSocket(io);

async function startServer() {
  try {
    await connectRedis();
    await initializeSocketRedisAdapter(io).catch((error) => {
      logger.warn("Socket.IO Redis adapter unavailable. Continuing in single-instance mode.", {
        error: error.message,
      });
    });

    httpServer.listen(PORT, () => {
      logger.info("Convox server live", {
        port: Number(PORT),
        mode: process.env.NODE_ENV || "development",
        health: `http://localhost:${PORT}/api/health`,
      });
    });

    seedAssistantUser()
      .then(() => syncAssistantChatsForAllUsers())
      .catch((error) => {
        logger.error("Assistant seeder failed", { error: error.message });
      });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
}

startServer();

async function shutdown(signal, exitCode = 0) {
  logger.info(`Received ${signal}. Shutting down gracefully.`);
  httpServer.close(async () => {
    await disconnectRedis();
    process.exit(exitCode);
  });
}

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection", { error: error.message, stack: error.stack });
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  shutdown("uncaughtException", 1);
});

process.on("SIGTERM", () => shutdown("SIGTERM", 0));
process.on("SIGINT", () => shutdown("SIGINT", 0));
