const mongoose = require("mongoose");
const User = require("../../models/User");
const Click = require("../../models/Click");
const Url = require("../../models/Url");
const { getRedisClient } = require("../../config/redis");
const logger = require("../../utils/logger");

class UserService {
  /**
   * Get users with pagination and search
   */
  static async getUsers(options = {}) {
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
      let filter = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      // Get URLs with pagination
      const users = await User.find(filter)
        .select("name email role createdAt totalUrls totalClicks")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await User.countDocuments(filter);

      return {
        users,
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
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  /**
   * Get user details
   */
  static async getUserDetails(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    } catch (error) {
      if (error.message === "User not found") {
        throw error;
      }

      throw new Error(`Failed to get user details: ${error.message}`);
    }
  }

  /**
   * Update user
   */
  static async updateUser(userId, updateData) {
    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid updates provided");
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Delete user
   */
  static async deleteUser(userId) {

    const session = await mongoose.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session);

        if (!user) {
          throw new Error("User not found");
        }

        // Delete all URLs created by this user
        await Url.deleteMany({ userId }).session(session);

        // Delete all clicks associated with user's URLs
        await Click.deleteMany({ userId }).session(session);

        // Delete user
        await User.findByIdAndDelete(userId).session(session);

        result = { message: "User deleted successfully" };
      });

      // Cache invalidation AFTER transaction commits
      // (no point invalidating if transaction rolls back)
      const redisClient = getRedisClient();
      if (redisClient) {
        let cursor = 0;
        do {
          const scanResult = await redisClient.scan(cursor, {
            MATCH: "analytics:admin:*",
            COUNT: 100,
          });
          cursor = scanResult.cursor;
          if (scanResult.keys.length > 0) {
            await redisClient.del(scanResult.keys);
          }
        } while (cursor !== 0);
      }

      return result;
    } catch (error) {
      if (error.message === "User not found") throw error;
      throw new Error(`Failed to delete user: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }
}

module.exports = UserService;
