import mongoose from "mongoose";
import logger from "./logger.js";

let connectPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = mongoose
    .connect(process.env.MONGO_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
      serverSelectionTimeoutMS: 10000,
    })
    .then((conn) => {
      logger.info("MongoDB connected", { host: conn.connection.host });
      return conn.connection;
    })
    .catch((error) => {
      logger.error("MongoDB connection error", { error: error.message });
      process.exit(1);
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export function getDatabaseHealth() {
  return {
    state: mongoose.connection.readyState,
    ready: mongoose.connection.readyState === 1,
  };
}

export default connectDB;
