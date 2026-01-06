const { validationResult } = require("express-validator");
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
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

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
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { name } = req.body || {};
      const { id } = req.params;

      // Build update object
      const updateData = {};
      if (name) updateData.name = name;

      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, "No valid updates provided", 400);
      }

      // Update user
      const user = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!user) {
        return errorResponse(res, "User not found", 404);
      }

      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        totalUrls: user.totalUrls,
        totalClicks: user.totalClicks,
      };

      return successResponse(
        res,
        { user: userResponse },
        "User updated successfully"
      );
    } catch (error) {
      console.error("Update user error:", error);

      return errorResponse(res, "Failed to update user");
    }
  }

  static async getUserDetails(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return errorResponse(res, "User ID is required", 400);
      }

      const user = await UserService.getUserDetails(id);

      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        totalUrls: user.totalUrls,
        totalClicks: user.totalClicks,
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

      if (!id) {
        return errorResponse(res, "User ID is required", 400);
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
