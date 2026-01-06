const redis = require("redis");
const { Redis } = require("@upstash/redis");

let client;

const connectRedis = async () => {
  try {
    //  Upstash
    if (process.env.UPSTASH_REDIS_REST_URL) {
      client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      console.log("Upstash Redis ready");
      await client.set("foo", "bar");
      await client.get("foo");
      return client;
    }

    // Local / self-hosted Redis
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
      },
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on("error", (err) => console.error("Redis Client Error", err));

    await client.connect();
    console.log("Redis connected successfully");

    return client;
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
