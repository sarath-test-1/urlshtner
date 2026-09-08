const Redis = require("ioredis");

const provider = process.env.REDIS_PROVIDER || "upstash"; // "local" | "upstash"

const connectionOptions = {
  maxRetriesPerRequest: null, // required by BullMQ workers
  enableReadyCheck: false,    // recommended, especially for Upstash
};

const connection =
  provider === "upstash"
    ? new Redis(process.env.UPSTASH_REDIS_URL, connectionOptions)
    : new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 5000,
        ...connectionOptions,
      });

connection.on("error", (err) => console.error("BullMQ Redis connection error:", err.message));

module.exports = { connection };