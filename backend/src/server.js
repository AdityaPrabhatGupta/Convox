import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import initializeSocket from "./socket/socketHandler.js";
import { setIoInstance } from "./socket/socket.js";

const PORT = process.env.PORT || 5000;

// Wrap Express app inside Node's HTTP server
const httpServer = createServer(app);

// Attach Socket.IO to the HTTP server with CORS config
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
    pingTimeout: 60000,  // drop connection if no response in 60s
    pingInterval: 25000, // ping client every 25s to keep connection alive
});

// Register all socket event listeners
setIoInstance(io);
initializeSocket(io);

// Start listening on the given port
httpServer.listen(PORT, () => {
    console.log(`
    
           CONVOX SERVER LIVE          
      Port    : ${PORT}                       
      Mode    : ${process.env.NODE_ENV || "development"}               
      Health  : http://localhost:${PORT}/api/health
      Socket  : ✅ Socket.IO attached    
    
    `);
});

// Handle unexpected async errors and shut down cleanly
process.on("unhandledRejection", (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    httpServer.close(() => process.exit(1));
});

// Handle OS termination signal and shut down gracefully
process.on("SIGTERM", () => {
    console.log("🛑 SIGTERM received. Shutting down gracefully...");
    httpServer.close(() => process.exit(0));
});
