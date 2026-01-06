const Url = require("../models/Url");
const User = require("../models/User");
const Click = require("../models/Click");
const { generateBase62 } = require("../utils/base62");
const { getRedisClient } = require("../config/redis");
const { scanAndDelete } = require("../utils/redisScanDelete");

class UrlService {
  /**
   * Create a short URL
   */
  static async createShortUrl(userId, longUrl, meta = {}, expiresAt = null) {
    try {
      // Generate unique short code
      let shortCode;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        shortCode = generateBase62(parseInt(process.env.SHORT_URL_LENGTH) || 6);
        const existingUrl = await Url.findOne({ shortCode });
        if (!existingUrl) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error("Failed to generate unique short code");
      }

      console.log("meta");
      console.log(meta);
      // Create URL document
      const urlData = {
        userId,
        shortCode,
        longUrl,
        title: meta.title || "",
        description: meta.description || "",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };

      const url = new Url(urlData);
      await url.save();

      // Update user's URL count
      await User.findByIdAndUpdate(userId, { $inc: { totalUrls: 1 } });

      // Cache the URL in Redis for faster access
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const cacheData = {
            longUrl: url.longUrl,
            userId: url.userId.toString(),
            isActive: url.isActive,
            expiresAt: url.expiresAt,
          };

          // Set cache with TTL (24 hours or until expiration)
          const ttl = url.expiresAt
            ? Math.floor((new Date(url.expiresAt) - new Date()) / 1000)
            : 24 * 60 * 60; // 24 hours

          if (ttl > 0) {
            await redisClient.setEx(
              `url:${shortCode}`,
              ttl,
              JSON.stringify(cacheData)
            );
          }
        } catch (cacheError) {
          console.error("Redis cache error:", cacheError);
          // Continue without cache
        }
      }

      if (redisClient) {
        await scanAndDelete(redisClient, "analytics:admin:*");
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to create short URL: ${error.message}`);
    }
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
              await redisClient.del(`url:${shortCode}`);
            }
          }
        } catch (cacheError) {
          console.error("Redis cache error:", cacheError);
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
              JSON.stringify(cacheData)
            );
          }
        } catch (cacheError) {
          console.error("Redis cache update error:", cacheError);
        }
      }

      return {
        long_url: url.longUrl,
        user_id: url.userId.toString(),
        url_id: url._id.toString(),
        from_cache: false,
      };
    } catch (error) {
      throw new Error(`Failed to get long URL: ${error.message}`);
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
                JSON.stringify(urlCacheData)
              );
            }
          }
        } catch (cacheError) {
          console.error("Cache update error:", cacheError);
        }

        try {
          await scanAndDelete(redisClient, `analytics:user:${url.userId}:*`);
        } catch (err) {
          console.error("Analytics cache clear error:", err);
        }
      }

      if (redisClient) {
        await scanAndDelete(redisClient, "analytics:admin:*");
      }

      return click;
    } catch (error) {
      console.error("Click recording error:", error);
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

      //   old
      //   const urls = await Url.find(filter)
      //     .sort(sortOptions)
      //     .skip(skip)
      //     .limit(parseInt(limit))
      //     .lean();

      //   // Get total count for pagination
      //   const total = await Url.countDocuments(filter);
      // old end

      const query = Url.findActive().where(filter);

      const urls = await query
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Prevents expired URLs from showing in dashboard
      // Prevents pagination mismatch
      const total = await Url.findActive().where(filter).countDocuments();

      return {
        urls,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUrls: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user URLs: ${error.message}`);
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

      let hasUpdates = false;

      for (const [apiField, modelField] of Object.entries(FIELD_MAP)) {
        if (updateData[apiField] !== undefined) {
          url[modelField] = updateData[apiField];
          hasUpdates = true;
        }
      }

      if (!hasUpdates) {
        throw new Error("No valid updates provided");
      }

      await url.save(); // single DB write, validators run

      // Invalidate cache
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          await redisClient.del(`url:${url.shortCode}`);
        } catch (cacheError) {
          console.error("Cache deletion error:", cacheError);
        }
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to update URL: ${error.message}`);
    }
  }

  /**
   * Delete URL
   */
  static async deleteUrl(urlId, userId) {
    try {
      const url = await Url.findOne({ _id: urlId, userId });

      if (!url) {
        throw new Error("URL not found");
      }

      // Delete URL and related clicks
      await Url.findByIdAndDelete(urlId);
      await Click.deleteMany({ urlId });

      // Update user's URL count
      await User.findByIdAndUpdate(userId, {
        $inc: {
          totalUrls: -1,
          totalClicks: -url.clickCount,
        },
      });

      // Remove from cache
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          await redisClient.del(`url:${url.shortCode}`);
        } catch (cacheError) {
          console.error("Cache deletion error:", cacheError);
        }
      }

      if (redisClient) {
        await scanAndDelete(redisClient, "analytics:admin:*");
      }

      return { message: "URL deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete URL: ${error.message}`);
    }
  }

  /**
   * Bulk delete URLs
   */
  static async bulkDeleteUrls(urlIds, userId) {
    try {
      // Find URLs to delete
      const urls = await Url.find({ _id: { $in: urlIds }, userId });

      if (urls.length === 0) {
        throw new Error("No URLs found to delete");
      }

      const totalClicks = urls.reduce((sum, url) => sum + url.clickCount, 0);
      const shortCodes = urls.map((url) => url.shortCode);

      // Delete URLs and related clicks
      await Url.deleteMany({ _id: { $in: urlIds }, userId });
      await Click.deleteMany({ urlId: { $in: urlIds } });

      // Update user's counts
      await User.findByIdAndUpdate(userId, {
        $inc: {
          totalUrls: -urls.length,
          totalClicks: -totalClicks,
        },
      });

      // Remove from cache
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const cacheKeys = shortCodes.map((code) => `url:${code}`);
          if (cacheKeys.length > 0) {
            await redisClient.del(cacheKeys);
          }
        } catch (cacheError) {
          console.error("Bulk cache deletion error:", cacheError);
        }
      }

      return {
        message: `Successfully deleted ${urls.length} URLs`,
        deletedCount: urls.length,
      };
    } catch (error) {
      throw new Error(`Failed to bulk delete URLs: ${error.message}`);
    }
  }

  /**
   * Get URL details
   */
  static async getUrlDetails(urlId, userId) {
    try {
      //   const url = await Url.findOne({ _id: urlId, userId });

      // Prevents viewing expired URLs via direct ID access
      // Consistent behavior with list view
      const url = await Url.findActive().findOne({ _id: urlId, userId });

      if (!url) {
        throw new Error("URL not found");
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to get URL details: ${error.message}`);
    }
  }
}

module.exports = UrlService;
