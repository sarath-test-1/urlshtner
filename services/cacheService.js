const { getRedisClient } = require("../config/redis");
const { analyticsCleanupQueue } = require("../queues/analyticsCleanup.queue");
const logger = require("../utils/logger");

const DEFAULT_TTL = 24 * 60 * 60; // 24h

async function cacheShortUrl(url) {
  const redisClient = getRedisClient();
  if (!redisClient) return;

  try {
    const ttl = url.expiresAt
      ? Math.floor((new Date(url.expiresAt) - Date.now()) / 1000)
      : DEFAULT_TTL;

    if (ttl <= 0) return;

    await redisClient.setEx(
      `url:${url.shortCode}`,
      ttl,
      JSON.stringify({
        longUrl: url.longUrl,
        userId: url.userId?.toString(),
        isActive: url.isActive,
        expiresAt: url.expiresAt,
      }),
    );

    // Invalidate admin analytics cache
    // If Redis is down, queue enqueue might also fail.
    try {
      await analyticsCleanupQueue.add("cleanup", {
        pattern: "analytics:admin:*",
      });
    } catch (_) {}
  } catch (err) {
    logger.warn({ message: "Redis cache error", error: err.message });
  }
}

async function invalidateUrlCache(shortCode) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.del(`url:${shortCode}`);
    } catch (cacheError) {
      logger.error({
        message: "Cache deletion error:",
        error: cacheError.message,
      });
    }
  }
}

async function bulkInvalidateUrlCache(cachekeys) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.del(cachekeys);
    } catch (cacheError) {
      logger.error({
        message: "Bulk cache deletion error:",
        error: cacheError.message,
      });
    }
  }
}

module.exports = {
  cacheShortUrl,
  invalidateUrlCache,
  bulkInvalidateUrlCache,
};
