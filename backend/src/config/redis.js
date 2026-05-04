import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import logger from "./logger.js";

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

const CACHE_TTLS = {
  user: 60,
  chats: 30,
};

const ensureRedisUrl = () => process.env.REDIS_URL?.trim();

export async function connectRedis() {
  const redisUrl = ensureRedisUrl();
  if (!redisUrl) {
    logger.warn("REDIS_URL not set. Redis caching and Socket.IO scaling are disabled.");
    return null;
  }

  if (redisClient?.isReady) return redisClient;

  redisClient = createClient({ url: redisUrl });
  redisClient.on("error", (error) => {
    logger.error("Redis client error", { error: error.message });
  });

  await redisClient.connect();
  logger.info("Redis connected");

  return redisClient;
}

export function getRedisClient() {
  return redisClient;
}

export function isRedisReady() {
  return Boolean(redisClient?.isReady);
}

export async function initializeSocketRedisAdapter(io) {
  const redisUrl = ensureRedisUrl();
  if (!redisUrl) return false;

  redisPubClient = createClient({ url: redisUrl });
  redisSubClient = redisPubClient.duplicate();

  redisPubClient.on("error", (error) => {
    logger.error("Redis pub client error", { error: error.message });
  });
  redisSubClient.on("error", (error) => {
    logger.error("Redis sub client error", { error: error.message });
  });

  await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
  io.adapter(createAdapter(redisPubClient, redisSubClient));
  logger.info("Socket.IO Redis adapter initialized");
  return true;
}

export async function disconnectRedis() {
  await Promise.allSettled(
    [redisClient, redisPubClient, redisSubClient]
      .filter(Boolean)
      .map((client) => client.quit()),
  );
}

export async function cacheGetJson(key) {
  if (!isRedisReady()) return null;

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn("Redis cache get failed", { key, error: error.message });
    return null;
  }
}

export async function cacheSetJson(key, value, ttlSeconds = 60) {
  if (!isRedisReady()) return;

  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn("Redis cache set failed", { key, error: error.message });
  }
}

export async function cacheDelete(keys) {
  if (!isRedisReady()) return;

  const list = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  if (!list.length) return;

  try {
    await redisClient.del(list);
  } catch (error) {
    logger.warn("Redis cache delete failed", { keys: list, error: error.message });
  }
}

export const cacheKeys = {
  userProfile: (userId) => `user:${userId}:profile`,
  userChats: (userId) => `user:${userId}:chats`,
};

export { CACHE_TTLS };
