const mongoose = require("mongoose");
const Url = require("../../models/Url");
const User = require("../../models/User");
const Click = require("../../models/Click");
const {
  cacheShortUrl,
  invalidateUrlCache,
  bulkInvalidateUrlCache,
} = require("../cacheService");
const { getRedisClient } = require("../../config/redis");
const { analyticsCleanupQueue } = require("../../queues/analyticsCleanup.queue");
var base62 = require("base62-random");
const logger = require("../../utils/logger");

class UrlService {
  /**
   * Create a short URL
   */
  //   static async createShortUrl(userId, longUrl, meta = {}, expiresAt = null) {
  //     try {
  //       // Generate unique short code
  //       let shortCode;
  //       let isUnique = false;
  //       let attempts = 0;
  //       const maxAttempts = 10;

  //       while (!isUnique && attempts < maxAttempts) {
  //         shortCode = base62(parseInt(process.env.SHORT_URL_LENGTH) || 6);
  //         const existingUrl = await Url.findOne({ shortCode });
  //         if (!existingUrl) {
  //           isUnique = true;
  //         }
  //         attempts++;
  //       }

  //       if (!isUnique) {
  //         throw new Error("Failed to generate unique short code");
  //       }

  //       // Create URL document
  //       const urlData = {
  //         userId,
  //         shortCode,
  //         longUrl,
  //         title: meta.title || "",
  //         description: meta.description || "",
  //         expiresAt: expiresAt ? new Date(expiresAt) : null,
  //       };

  //       const url = new Url(urlData);
  //       await url.save();

  //       // Update user's URL count
  //       if (userId) {
  //         await User.findByIdAndUpdate(userId, { $inc: { totalUrls: 1 } });
  //       }

  //       // Cache the URL in Redis for faster access
  //       const redisClient = getRedisClient();
  //       if (redisClient) {
  //         try {
  //           const cacheData = {
  //             longUrl: url.longUrl,
  //             userId: url.userId.toString(),
  //             isActive: url.isActive,
  //             expiresAt: url.expiresAt,
  //           };

  //           // Set cache with TTL (24 hours or until expiration)
  //           const ttl = url.expiresAt
  //             ? Math.floor((new Date(url.expiresAt) - new Date()) / 1000)
  //             : 24 * 60 * 60; // 24 hours

  //           // If expiresAt is past, TTL becomes negative.
  //           if (ttl > 0) {
  //             await redisClient.setEx(
  //               `url:${shortCode}`,
  //               ttl,
  //               JSON.stringify(cacheData)
  //             );
  //           }
  //         } catch (cacheError) {
  //           console.error("Redis cache error:", cacheError);
  //           // Continue without cache
  //         }
  //       }

  //       if (redisClient) {
  //         await scanAndDelete(redisClient, "analytics:admin:*");
  //       }

  //       return url;
  //     } catch (error) {
  //       throw new Error(`Failed to create short URL: ${error.message}`);
  //     }
  //   }

  /**
   * Create a short URL
   */
  static async createShortUrl(userId, longUrl, meta = {}, expiresAt = null) {
    // A transaction would pair Url.create + User.findByIdAndUpdate atomically, but the tradeoff isn't worth it here because:
    // totalUrls is a denormalized counter — it's derived data, not source of truth. If it's off by 1, it's not catastrophic.
    // Transactions add latency on every URL creation, which is your most frequent write operation.
    // You can always recompute totalUrls via Url.countDocuments({ userId }) if needed.

    const LENGTH = parseInt(process.env.SHORT_URL_LENGTH, 10) || 6;
    const MAX_ATTEMPTS = 5;

    for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
      const shortCode = base62(LENGTH);

      try {
        const url = await Url.create({
          userId,
          shortCode,
          longUrl,
          title: meta.title || "",
          description: meta.description || "",
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        });

        // Update user's URL count (fire & forget)
        if (userId) {
          User.findByIdAndUpdate(userId, { $inc: { totalUrls: 1 } }).catch(
            (err) => {
              logger.warn({
                message: "Failed to increment totalUrls",
                userId,
                error: err.message,
              });
            },
          );
        }

        // Cache in Redis
        cacheShortUrl(url); // fire-and-forget is fine for this project

        return url;
      } catch (err) {
        // Retry only on duplicate shortCode
        if (err.code !== 11000) {
          throw new Error(`Failed to create short URL: ${err.message}`, {
            cause: err,
          });
        }

        // if it's a duplicate, you silently retry with no delay.
        // At scale, 5 rapid retries under high collision probability just hammers the DB. so add a small jitter:
        // small backoff before retry
        await new Promise((res) => setTimeout(res, Math.random() * 50));
      }
    }

    throw new Error("Failed to generate unique short code after retries");
  }

  /**
   * Get long URL by short code
   */
  static async getLongUrl(shortCode) {
    try {
      // Try Redis cache first
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(`url:${shortCode}`);
          if (cachedData) {
            const urlData = JSON.parse(cachedData);

            // Check if cached URL is still valid
            if (
              urlData.isActive &&
              (!urlData.expiresAt || new Date(urlData.expiresAt) > new Date())
            ) {
              return {
                long_url: urlData.longUrl,
                user_id: urlData.userId,
                from_cache: true,
              };
            } else {
              // Remove expired cache entry
              await invalidateUrlCache(shortCode);
            }
          }
        } catch (cacheError) {
          logger.warn({
            message: "Redis cache error",
            error: cacheError.message,
          });
        }
      }

      // Fallback to database
      //   const url = await Url.findOne({ shortCode, isActive: true });
      const url = await Url.findActive().findOne({ shortCode });

      if (!url) {
        return null;
      }

      // Update cache
      if (redisClient) {
        try {
          const cacheData = {
            longUrl: url.longUrl,
            userId: url.userId.toString(),
            isActive: url.isActive,
            expiresAt: url.expiresAt,
          };

          const ttl = url.expiresAt
            ? Math.floor((new Date(url.expiresAt) - new Date()) / 1000)
            : 24 * 60 * 60;

          if (ttl > 0) {
            await redisClient.setEx(
              `url:${shortCode}`,
              ttl,
              JSON.stringify(cacheData),
            );
          }
        } catch (cacheError) {
          logger.warn({
            message: "Redis cache update error:",
            error: cacheError.message,
          });
        }
      }

      return {
        long_url: url.longUrl,
        user_id: url.userId.toString(),
        url_id: url._id.toString(),
        from_cache: false,
      };
    } catch (error) {
      throw new Error(`Failed to get long URL: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Record click analytics
   */
  static async recordClick(shortCode, urlData, clientInfo) {
    try {
      const url = await Url.findOne({ shortCode });
      if (!url) {
        return;
      }

      // Increment click count
      await url.incrementClick();

      // Update user's total clicks
      await User.findByIdAndUpdate(url.userId, { $inc: { totalClicks: 1 } });

      // Create click record for analytics
      const clickData = {
        urlId: url._id,
        userId: url.userId,
        shortCode,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        referrer: clientInfo.referrer || "",
        country: clientInfo.country || "Unknown",
        city: clientInfo.city || "Unknown",
        browser: clientInfo.browser || "Unknown",
        os: clientInfo.os || "Unknown",
        device: clientInfo.device || "unknown",
        timestamp: new Date(),
      };

      const click = new Click(clickData);
      await click.save();

      // Update cache with new click count
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(`url:${shortCode}`);
          if (cachedData) {
            const urlCacheData = JSON.parse(cachedData);
            urlCacheData.clickCount = url.clickCount;

            const ttl = await redisClient.ttl(`url:${shortCode}`);
            if (ttl > 0) {
              await redisClient.setEx(
                `url:${shortCode}`,
                ttl,
                JSON.stringify(urlCacheData),
              );
            }
          }
        } catch (cacheError) {
          logger.warn({
            message: "Cache update error:",
            error: cacheError.message,
          });
        }
      }

      analyticsCleanupQueue.add("cleanup", {
        pattern: `analytics:user:${url.userId}:*`,
      });

      analyticsCleanupQueue.add("cleanup", {
        pattern: "analytics:admin:*",
      });

      return click;
    } catch (error) {
      logger.error({
        message: "Click recording failed",
        shortCode,
        error: error.message,
      });
      // Don't throw error as this shouldn't break URL redirection
    }
  }

  /**
   * Get user's URLs with pagination and search
   */
  static async getUserUrls(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      // Build search filter
      let filter = { userId };

      if (search) {
        filter.$or = [
          { longUrl: { $regex: search, $options: "i" } },
          { title: { $regex: search, $options: "i" } },
          { shortCode: { $regex: search, $options: "i" } },
        ];
      }

      // Get URLs with pagination
      const urls = await Url.find(filter)
        .select(
          "userId shortCode longUrl clickCount isActive expiresAt lastAccessedAt title description createdAt",
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await Url.countDocuments(filter);

      return {
        urls,
        meta: {
          current_page: page,
          per_page: limit,
          total,
          last_page: Math.ceil(total / limit),
          from: total === 0 ? null : (page - 1) * limit + 1,
          to: Math.min(page * limit, total),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user URLs: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Update URL
   */
  static async updateUrl(url, updateData) {
    try {
      // Allowed fields (API → model mapping)
      const FIELD_MAP = {
        long_url: "longUrl",
        expires_at: "expiresAt",
        title: "title",
        description: "description",
        is_active: "isActive",
      };

      for (const [apiField, modelField] of Object.entries(FIELD_MAP)) {
        if (updateData[apiField] !== undefined) {
          url[modelField] = updateData[apiField];
        }
      }

      await url.save();

      // Invalidate cache
      await invalidateUrlCache(url.shortCode);

      return url;
    } catch (error) {
      throw new Error(`Failed to update URL: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Delete URL
   */
  static async deleteUrl(url, user) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Delete URL document
        await url.deleteOne({ session });

        // 2. Delete related clicks
        await Click.deleteMany({ urlId: url._id }).session(session);

        // 3. Update user stats
        await User.findByIdAndUpdate(user._id, {
          $inc: {
            totalUrls: -1,
            totalClicks: -url.clickCount,
          },
        }).session(session);
      });

      // 4. Cache cleanup AFTER transaction commits
      await invalidateUrlCache(url.shortCode);
      analyticsCleanupQueue.add("cleanup", { pattern: "analytics:admin:*" });

      return { message: "URL deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete URL: ${error.message}`, {
        cause: error,
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Bulk delete URLs
   */
  static async bulkDeleteUrls(urls, userId) {
    const session = await mongoose.startSession();

    try {
      const urlIds = urls.map((u) => u._id);
      const shortCodes = urls.map((u) => u.shortCode);
      const totalClicks = urls.reduce((sum, url) => sum + url.clickCount, 0);

      await session.withTransaction(async () => {
        await Url.deleteMany({ _id: { $in: urlIds } }).session(session);
        await Click.deleteMany({ urlId: { $in: urlIds } }).session(session);

        await User.findByIdAndUpdate(userId, {
          $inc: {
            totalUrls: -urls.length,
            totalClicks: -totalClicks,
          },
        }).session(session);
      });

      // Cache invalidation after transaction commits
      const cacheKeys = shortCodes.map((code) => `url:${code}`);
      if (cacheKeys.length > 0) {
        await bulkInvalidateUrlCache(cacheKeys);
      }

      analyticsCleanupQueue.add("cleanup", { pattern: "analytics:admin:*" });

      return {
        message: `Successfully deleted ${urls.length} URLs`,
        deletedCount: urls.length,
      };
    } catch (error) {
      throw new Error(`Failed to bulk delete URLs: ${error.message}`, {
        cause: error,
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = UrlService;
