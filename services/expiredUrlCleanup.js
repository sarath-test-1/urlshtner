const { bulkInvalidateUrlCache } = require("../services/cacheService");
const Url = require("../models/Url");
const logger = require("../utils/logger");

let isRunning = false;

const cleanupExpiredUrls = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const expiredUrls = await Url.find(
      { expiresAt: { $lte: new Date() }, isActive: true },
      { shortCode: 1 },
    ).lean();

    if (expiredUrls.length === 0) return;

    await Url.updateMany(
      { _id: { $in: expiredUrls.map((u) => u._id) } },
      { $set: { isActive: false } },
    );

    const cacheKeys = expiredUrls.map((u) => `url:${u.shortCode}`);
    await bulkInvalidateUrlCache(cacheKeys);

    logger.info(`Deactivated ${expiredUrls.length} expired URLs`);
  } catch (error) {
    logger.error({
      message: "Expired URL cleanup error:",
      error: error.message,
    });
  } finally {
    isRunning = false;
  }
};

const startCleanupJob = () => {
  cleanupExpiredUrls(); // run immediately on start
  return setInterval(cleanupExpiredUrls, 60 * 60 * 1000);
};

module.exports = { startCleanupJob };
