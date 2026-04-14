import "dotenv/config";
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';        
import messageRoutes from './routes/messageRoutes.js';  
import chatRoutes from "./routes/chatRoutes.js";        

const app = express();

connectDB();

const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:3000",
    "http://localhost:5173",
].filter(Boolean);

//CORS
app.use(
    cors({
        origin(origin, callback) {
            // Allow browserless tools and configured local frontend origins.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    })
);

//Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Health Check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Chat Application is Running !!",
        environment: process.env.NODE_ENV,
    });
});

//Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use("/api/chat", chatRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

export default app;