const { validationResult } = require("express-validator");
const User = require("../models/User");
const { generateToken, generateRefreshToken } = require("../middleware/auth");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
} = require("../utils/apiResponse");
const { getRedisClient } = require("../config/redis");

class AuthController {
  /**
   * Register a new user
   */
  static async register(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { name, email, password, role = "user" } = req.body || {};

      // Check if user already exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return errorResponse(res, "User with this email already exists", 400);
      }

      // Create new user
      const userData = { name, email, password };

      // Only allow admin role if user is already an admin (prevent privilege escalation)
      if (role === "admin" && (!req.user || req.user.role !== "admin")) {
        userData.role = "user";
      } else {
        userData.role = role;
      }

      const user = new User(userData);
      await user.save();

      // Generate token
      const accessToken = generateToken(user._id, "15m");
      const refreshToken = generateRefreshToken(user._id, "30d");

      // Update last login
      await user.updateLastLogin();

      // Return user data without password
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        total_urls: user.totalUrls,
        total_clicks: user.totalClicks,
      };

      // Set refresh token in HTTP-Only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Remove from cache
      const redisClient = getRedisClient();
      if (redisClient) {
        // Use SCAN for non-blocking iteration in production
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redisClient.scan(
            cursor,
            "MATCH",
            "analytics:admin:*",
            "COUNT",
            100
          );
          cursor = nextCursor;
          if (keys.length) {
            await redisClient.del(keys);
          }
        } while (cursor !== "0");
      }

      return successResponse(
        res,
        {
          user: userResponse,
          accessToken,
          tokenType: "Bearer",
        },
        "User registered successfully",
        201
      );
    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return errorResponse(res, `${field} already exists`, 400);
      }

      return errorResponse(res, "Registration failed");
    }
  }

  /**
   * Login user
   */
  static async login(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { email, password } = req.body || {};

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return unauthorizedResponse(res, "Invalid credentials");
      }

      if (!user.isActive) {
        return unauthorizedResponse(res, "Invalid credentials");
      }

      // Compare password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return unauthorizedResponse(res, "Invalid credentials");
      }

      // Generate token
      const accessToken = generateToken(user._id, "15m");
      const refreshToken = generateRefreshToken(user._id, "30d");

      // Update last login
      await user.updateLastLogin();

      // Return user data without password
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

      // Set refresh token in HTTP-Only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return successResponse(
        res,
        {
          user: userResponse,
          accessToken,
          tokenType: "Bearer",
        },
        "Login successful"
      );
    } catch (error) {
      console.error("Login error:", error);
      return errorResponse(res, "Login failed");
    }
  }

  /**
   * Logout user and clear refresh token
   */
  static async logout(req, res) {
    try {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });

      return successResponse(res, null, "Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      return errorResponse(res, "Logout failed");
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(req, res) {
    try {
      const userId = req.userId;
      const user = req.user;

      if (!userId || !user) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // Generate new token
      const newAccessToken = generateToken(userId, "15m");

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
        {
          accessToken: newAccessToken,
          user: userResponse,
          tokenType: "Bearer",
        },
        "Token refreshed successfully"
      );
    } catch (error) {
      console.error("Refresh token error:", error);
      return errorResponse(res, "Failed to refresh token");
    }
  }

  /**
   * Get current loggedin user
   */
  static async getUser(req, res) {
    try {
      const user = await User.findById(req.userId);

      if (!user || !user.isActive) {
        return unauthorizedResponse(res, "User not found");
      }

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
        "User retrieved successfully"
      );
    } catch (error) {
      console.error("Get user error:", error);
      return errorResponse(res, "Failed to get user");
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId);

      if (!user || !user.isActive) {
        return unauthorizedResponse(res, "User not found");
      }

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
        "Profile retrieved successfully"
      );
    } catch (error) {
      console.error("Get profile error:", error);
      return errorResponse(res, "Failed to get profile");
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { name } = req.body || {};
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // Build update object
      const updateData = {};
      if (name) updateData.name = name;

      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, "No valid updates provided", 400);
      }

      // Update user
      const user = await User.findByIdAndUpdate(userId, updateData, {
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
        created_at: user.createdAt,
        last_login: user.lastLogin,
        total_urls: user.totalUrls,
        total_clicks: user.totalClicks,
      };

      return successResponse(
        res,
        { user: userResponse },
        "Profile updated successfully"
      );
    } catch (error) {
      console.error("Update profile error:", error);

      return errorResponse(res, "Failed to update profile");
    }
  }

  /**
   * Change password
   */
  static async changePassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { current_password, new_password } = req.body || {};
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // Find user with password
      const user = await User.findById(userId).select("+password");
      if (!user) {
        return errorResponse(res, "User not found", 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        current_password
      );

      if (!isCurrentPasswordValid) {
        return errorResponse(res, "Invalid credentials", 400);
      }

      const isSamePassword = await user.comparePassword(new_password);
      if (isSamePassword) {
        return errorResponse(
          res,
          "New password must be different from current password",
          400
        );
      }

      // Update password
      user.password = new_password;
      user.passwordChangedAt = new Date();
      await user.save();

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });

      return successResponse(res, null, "Password changed successfully");
    } catch (error) {
      console.error("Change password error:", error);
      return errorResponse(res, "Failed to change password");
    }
  }

  /**
   * Deactivate account
   */
  static async deactivateAccount(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      const { password } = req.body || {};

      // Find user with password
      const user = await User.findById(userId).select("+password");
      if (!user) {
        return errorResponse(res, "User not found", 404);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return errorResponse(res, "Invalid password", 400);
      }

      // Deactivate account
      user.isActive = false;
      await user.save();

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });

      return successResponse(res, null, "Account deactivated successfully");
    } catch (error) {
      console.error("Deactivate account error:", error);
      return errorResponse(res, "Failed to deactivate account");
    }
  }
}

module.exports = AuthController;
