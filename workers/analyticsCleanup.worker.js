require("dotenv").config();
const { Worker } = require("bullmq");
const { connection } = require("../config/queueRedis");
const { getRedisClient } = require("../config/redis");
const { scanAndDelete } = require("../utils/redisScanDelete");

new Worker(
  "analytics-cleanup",
  async (job) => {
    const redis = getRedisClient();
    if (redis) {
      await scanAndDelete(redis, job.data.pattern);
    }
  },
  {
    connection,
    removeOnComplete: true,
    removeOnFail: 100, // keep some failed jobs for debugging
  }
);
