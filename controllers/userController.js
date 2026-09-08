const User = require("../models/User");
const UserService = require("../services/userService");
const {
  successResponse,
  listingSuccessResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
} = require("../utils/apiResponse");

class UserController {
  static async getUsers(req, res) {
    try {
      const SORT_FIELD_MAP = {
        name: "name",
        created_at: "createdAt",
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        search: req.query.search || "",
        sortBy: SORT_FIELD_MAP[req.query.sort_by] || "createdAt",
        sortOrder: req.query.sort_order || "desc",
      };

      const result = await UserService.getUsers(options);

      // Format URLs for response
      const formattedUsers = result.users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        total_urls: user.totalUrls,
        total_clicks: user.totalClicks,
      }));

      return listingSuccessResponse(
        res,
        formattedUsers,
        result.meta,
        "Users retrieved successfully"
      );
    } catch (error) {
      console.error("Get users error:", error);
      return errorResponse(res, error.message || "Failed to get users");
    }
  }

  /**
   * Update user
   */
  static async updateUser(req, res) {
    try {
      const { name } = req.body || {};
      const { id } = req.params;

      // Build update object
      const updateData = {};
      if (name) updateData.name = name;

      const user = await UserService.updateUser(id, updateData);

      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        last_login: user.lastLogin,
        total_urls: user.totalUrls,
        total_clicks: user.totalClicks,
      };

      return successResponse(
        res,
        { user: userResponse },
        "User updated successfully"
      );
    } catch (error) {
      console.error("Update user error:", error);

      if (error.message === "User not found") {
        return notFoundResponse(res, "User not found");
      }

      if (error.message === "No valid updates provided") {
        return errorResponse(res, "No valid updates provided", 400);
      }

      return errorResponse(res, "Failed to update user");
    }
  }

  static async getUserDetails(req, res) {
    try {
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      const { id } = req.params;

      const user = await UserService.getUserDetails(id);

      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        last_login: user.lastLogin,
        total_urls: user.totalUrls,
        total_clicks: user.totalClicks,
      };

      return successResponse(
        res,
        userResponse,
        "User details retrieved successfully"
      );
    } catch (error) {
      console.error("Get user details error:", error);

      if (error.message === "User not found") {
        return notFoundResponse(res, "User not found");
      }

      return errorResponse(res, error.message || "Failed to get user details");
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUserId = req.userId;

      // Prevent self-deletion
      if (id === currentUserId) {
        return errorResponse(res, "Cannot delete your own account", 400);
      }

      const result = await UserService.deleteUser(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      console.error("Delete User error:", error);

      if (error.message === "User not found") {
        return notFoundResponse(res, "User not found");
      }

      return errorResponse(res, error.message || "Failed to delete user");
    }
  }
}

module.exports = UserController;
