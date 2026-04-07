import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from '../routes/userRoutes.js';   // add this
import messageRoutes from '../routes/messageRoutes.js'
import chatRoutes from "../routes/chatRoutes.js";

const app = express();

connectDB();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
    })
);

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Chat Application is Running !!",
        environment: process.env.NODE_ENV,
    });
});

// Routes
app.use("/api/users", userRoutes);  
app.use('/api/messages', messageRoutes);   
app.use("/api/chat", chatRoutes);


app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

export default app;