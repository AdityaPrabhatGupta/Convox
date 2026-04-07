import "dotenv/config";
import app from "./app.js";

const PORT= process.env.PORT || 5000;

const server = app.listen(PORT ,() =>{
    console.log(`
        Server running                      
    Port     : ${PORT}                        
    Mode     : ${process.env.NODE_ENV}     
    Health   : http://localhost:${PORT}/api/health 
        `);
});

// If the server crashes or is stopped, close cleanly
process.on("unhandledRejection",(err)=>{
    console.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});
process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => process.exit(0));
});