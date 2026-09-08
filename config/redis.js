const redis = require("redis");
const { Redis } = require("@upstash/redis");

let client;

const provider = process.env.REDIS_PROVIDER || "upstash"; // "local" | "upstash"

const connectRedis = async () => {
  try {
     // Upstash
    if (provider === "upstash") {
      if (process.env.UPSTASH_REDIS_REST_URL) {
        client = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        console.log("Upstash Redis ready");
        return client;
        }
    }

    else {
      // Local / self-hosted Redis
      client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || "localhost",
          port: Number(process.env.REDIS_PORT) || 6379,
          connectTimeout: 5000, // fail fast if Redis unreachable
        },
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
      });

      client.on("error", (err) => console.error("Redis Client Error", err));

      await client.connect();
      console.log("Redis connected: Local");
      return client;
    }
  } catch (error) {
    console.error("Error connecting to Redis:", error.message);
    // Don't exit process, continue without cache
    return null;
  }
};

const getRedisClient = () => client;

module.exports = {
  connectRedis,
  getRedisClient,
};
