const mongoose = require("mongoose");
const User = require("../models/User");
const Url = require("../models/Url");
const Click = require("../models/Click");
const { getRedisClient } = require("../config/redis");

class AnalyticsService {
  /**
   * Get user analytics dashboard data
   */
  static async getUserAnalytics(userId, timeRange = {}) {
    try {
      const { startDate, endDate } = timeRange;
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const redisClient = getRedisClient();

      const cacheKey = `analytics:user:${userId}:from:${
        startDate || "all"
      }:to:${endDate || "all"}`;

      if (redisClient) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (err) {
          console.error("Analytics cache read error:", err);
        }
      }

      let urlDateFilter = {};
      let clickDateFilter = {};

      if (startDate && endDate) {
        urlDateFilter =
          startDate && endDate
            ? {
                createdAt: {
                  $gte: new Date(startDate),
                  $lte: new Date(endDate),
                },
              }
            : {};

        clickDateFilter =
          startDate && endDate
            ? {
                timestamp: {
                  $gte: new Date(startDate),
                  $lte: new Date(endDate),
                },
              }
            : {};
      }

      // Get basic stats
      const [user, totalUrls, totalClicks, recentUrls, popularUrls] =
        await Promise.all([
          User.findById(userId).select("totalUrls totalClicks createdAt"),
          Url.countDocuments({ userId, ...urlDateFilter }),
          Click.countDocuments({ userId, ...clickDateFilter }),
          Url.find({ userId, ...urlDateFilter })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("shortCode longUrl createdAt clickCount"),
          Url.find({ userId, ...urlDateFilter })
            .sort({ clickCount: -1 })
            .limit(10)
            .select("shortCode longUrl clickCount createdAt"),
        ]);

      // Get device and browser stats
      const [
        deviceStats,
        browserStats,
        referrerStats,
        countryStats,
        cityStats,
        platformStats,
      ] = await Promise.all([
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$device", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$browser", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$referrer", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
              country: { $ne: "Unknown" },
            },
          },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
              city: { $ne: "Unknown" },
            },
          },
          { $group: { _id: "$city", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              userId: userObjectId,
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$os", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

      const analyticsData = {
        overview: {
          total_urls: totalUrls,
          total_clicks: totalClicks,
        },
        recent_urls: recentUrls.map((url) => ({
          short_code: url.shortCode,
          long_url: url.longUrl,
          created_at: url.createdAt,
          click_count: url.clickCount,
        })),
        popular_urls: popularUrls.map((url) => ({
          short_code: url.shortCode,
          long_url: url.longUrl,
          click_count: url.clickCount,
          created_at: url.createdAt,
        })),
        stats: {
          devices: deviceStats.map((stat) => ({
            device: stat._id || "Unknown",
            count: stat.count,
          })),
          browsers: browserStats.map((stat) => ({
            browser: stat._id || "Unknown",
            count: stat.count,
          })),
          referrers: referrerStats.map((stat) => ({
            referrer: stat._id || "Unknown",
            count: stat.count,
          })),
          countries: countryStats.map((stat) => ({
            country: stat._id || "Unknown",
            count: stat.count,
          })),
          cities: cityStats.map((stat) => ({
            city: stat._id || "Unknown",
            count: stat.count,
          })),
          platforms: platformStats.map((stat) => ({
            platform: stat._id || "Unknown",
            count: stat.count,
          })),
        },
      };

      if (redisClient) {
        try {
          // 5 minutes is perfect for analytics
          await redisClient.setEx(cacheKey, 180, JSON.stringify(analyticsData));
        } catch (err) {
          console.error("Analytics cache write error:", err);
        }
      }

      return analyticsData;
    } catch (error) {
      throw new Error(`Failed to get user analytics: ${error.message}`);
    }
  }

  /**
   * Get admin analytics dashboard data
   */
  static async getAdminAnalytics(timeRange = {}) {
    try {
      const { startDate, endDate } = timeRange;
      const redisClient = getRedisClient();

      const cacheKey =
        startDate && endDate
          ? `analytics:admin:${startDate}:${endDate}`
          : `analytics:admin:all`;

      // Try cache first
      if (redisClient) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (err) {
          console.error("Admin analytics cache read error:", err);
        }
      }

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Build date filter
      let urlDateFilter = {};
      let clickDateFilter = {};
      let userDateFilter = {};

      if (startDate && endDate) {
        urlDateFilter =
          startDate && endDate
            ? {
                createdAt: {
                  $gte: start,
                  $lte: end,
                },
              }
            : {};
        userDateFilter =
          startDate && endDate
            ? {
                createdAt: {
                  $gte: start,
                  $lte: end,
                },
              }
            : {};

        clickDateFilter =
          startDate && endDate
            ? {
                timestamp: {
                  $gte: start,
                  $lte: end,
                },
              }
            : {};
      }

      const activeUsersFilter = {
        isActive: true,
        ...(start && end
          ? {
              lastLogin: {
                $gte: start,
                $lte: end,
              },
            }
          : {}),
      };

      // Get basic stats
      const [
        totalUsers,
        activeUsers,
        totalUrls,
        totalClicks,
        recentUsers,
        topUrls,
        userGrowth,
      ] = await Promise.all([
        User.countDocuments({ ...userDateFilter }),
        User.countDocuments(activeUsersFilter),
        Url.countDocuments({ ...urlDateFilter }),
        Click.countDocuments({ ...clickDateFilter }),
        User.find({ ...userDateFilter })
          .sort({ createdAt: -1 })
          .limit(10)
          .select("name email createdAt totalUrls totalClicks"),
        Url.find({ ...urlDateFilter })
          .sort({ clickCount: -1 })
          .limit(10)
          .populate("userId", "name email")
          .select("shortCode longUrl clickCount createdAt userId"),
        User.aggregate([
          { $match: { ...userDateFilter } },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
          { $limit: 30 },
        ]),
      ]);

      // Get top performing users
      const topUsers = await User.find({})
        .sort({ totalClicks: -1 })
        .limit(10)
        .select("name email totalUrls totalClicks createdAt");

      // Get system-wide demographics
      const [
        deviceStats,
        browserStats,
        referrerStats,
        countryStats,
        cityStats,
        platformStats,
      ] = await Promise.all([
        Click.aggregate([
          { $match: { ...clickDateFilter } },
          { $group: { _id: "$device", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: { ...clickDateFilter } },
          { $group: { _id: "$browser", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$referrer", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              ...clickDateFilter,
              country: { $ne: "Unknown" },
            },
          },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              ...clickDateFilter,
              city: { $ne: "Unknown" },
            },
          },
          { $group: { _id: "$city", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          {
            $match: {
              ...clickDateFilter,
            },
          },
          { $group: { _id: "$os", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

      const analytics = {
        overview: {
          total_users: totalUsers,
          active_users: activeUsers,
          total_urls: totalUrls,
          total_clicks: totalClicks,
        },
        trends: {
          user_growth: userGrowth.map((growth) => ({
            date: `${growth._id.year}-${String(growth._id.month).padStart(
              2,
              "0"
            )}-${String(growth._id.day).padStart(2, "0")}`,
            users: growth.count,
          })),
        },
        top_performers: {
          urls: topUrls.map((url) => ({
            short_code: url.shortCode,
            long_url: url.longUrl,
            click_count: url.clickCount,
            owner: url.userId
              ? {
                  name: url.userId.name,
                  email: url.userId.email,
                }
              : null,
            created_at: url.createdAt,
          })),
          users: topUsers.map((user) => ({
            name: user.name,
            email: user.email,
            total_urls: user.totalUrls,
            total_clicks: user.totalClicks,
            joined_at: user.createdAt,
          })),
        },
        recent: {
          users: recentUsers.map((user) => ({
            name: user.name,
            email: user.email,
            total_urls: user.totalUrls,
            total_clicks: user.totalClicks,
            joined_at: user.createdAt,
          })),
        },
        stats: {
          devices: deviceStats.map((stat) => ({
            device: stat._id || "Unknown",
            count: stat.count,
          })),
          browsers: browserStats.map((stat) => ({
            browser: stat._id || "Unknown",
            count: stat.count,
          })),
          referrers: referrerStats.map((stat) => ({
            referrer: stat._id || "Unknown",
            count: stat.count,
          })),
          countries: countryStats.map((stat) => ({
            country: stat._id || "Unknown",
            count: stat.count,
          })),
          cities: cityStats.map((stat) => ({
            city: stat._id || "Unknown",
            count: stat.count,
          })),
          platforms: platformStats.map((stat) => ({
            platform: stat._id || "Unknown",
            count: stat.count,
          })),
        },
      };

      // Store in cache
      if (redisClient) {
        await redisClient.setEx(
          cacheKey,
          300, // 5 minutes
          JSON.stringify(analytics)
        );
      }

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get admin analytics: ${error.message}`);
    }
  }
}

module.exports = AnalyticsService;
