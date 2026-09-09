const AuthService = require("../../services/v1/authService");
const {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} = require("../../utils/apiResponse");

const REFRESH_COOKIE_OPTIONS = (isProduction) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

const CLEAR_COOKIE_OPTIONS = (isProduction) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
});

class AuthController {
  static async register(req, res) {
    try {
      const { name, email, password, role } = req.body || {};
      const user = await AuthService.register(
        { name, email, password, role },
        req.user,
      );
      const { accessToken, refreshToken } = AuthService.generateTokens(
        user._id,
      );

      res.cookie(
        "refreshToken",
        refreshToken,
        REFRESH_COOKIE_OPTIONS(process.env.NODE_ENV === "production"),
      );

      return successResponse(
        res,
        {
          user: AuthService.formatUser(user),
          access_token: accessToken,
          token_type: "Bearer",
        },
        "User registered successfully",
        201,
      );
    } catch (error) {
      console.error("Registration error:", error);
      if (error.message === "User with this email already exists") {
        return errorResponse(res, error.message, 400);
      }
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return errorResponse(res, `${field} already exists`, 400);
      }
      return errorResponse(res, "Registration failed");
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body || {};
      const user = await AuthService.login({ email, password });
      const { accessToken, refreshToken } = AuthService.generateTokens(
        user._id,
      );

      res.cookie(
        "refreshToken",
        refreshToken,
        REFRESH_COOKIE_OPTIONS(process.env.NODE_ENV === "production"),
      );

      return successResponse(
        res,
        {
          user: AuthService.formatUser(user, true),
          access_token: accessToken,
          token_type: "Bearer",
        },
        "Login successful",
      );
    } catch (error) {
      console.error("Login error:", error);
      if (error.message === "Invalid credentials") {
        return unauthorizedResponse(res, "Invalid credentials");
      }
      return errorResponse(res, "Login failed");
    }
  }

  static async logout(req, res) {
    try {
      res.clearCookie(
        "refreshToken",
        CLEAR_COOKIE_OPTIONS(process.env.NODE_ENV === "production"),
      );
      return successResponse(res, null, "Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      return errorResponse(res, "Logout failed");
    }
  }

  static async refreshToken(req, res) {
    try {
      const { userId, user } = req;
      if (!userId || !user)
        return unauthorizedResponse(res, "Authentication required");

      const { accessToken } = AuthService.generateTokens(userId);

      return successResponse(
        res,
        {
          access_token: accessToken,
          user: AuthService.formatUser(user, true),
          token_type: "Bearer",
        },
        "Token refreshed successfully",
      );
    } catch (error) {
      console.error("Refresh token error:", error);
      return errorResponse(res, "Failed to refresh token");
    }
  }

  static async getUser(req, res) {
    try {
      const user = await AuthService.getUserById(req.userId);
      return successResponse(
        res,
        { user: AuthService.formatUser(user, true) },
        "User retrieved successfully",
      );
    } catch (error) {
      console.error("Get user error:", error);
      if (error.message === "User not found")
        return unauthorizedResponse(res, "User not found");
      return errorResponse(res, "Failed to get user");
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await AuthService.getUserById(req.userId);
      return successResponse(
        res,
        { user: AuthService.formatUser(user, true) },
        "Profile retrieved successfully",
      );
    } catch (error) {
      console.error("Get profile error:", error);
      if (error.message === "User not found")
        return unauthorizedResponse(res, "User not found");
      return errorResponse(res, "Failed to get profile");
    }
  }

  static async updateProfile(req, res) {
    try {
      const { userId } = req;
      if (!userId) return unauthorizedResponse(res, "Authentication required");

      const { name } = req.body || {};
      const updateData = {};
      if (name) updateData.name = name;

      const user = await AuthService.updateProfile(userId, updateData);
      return successResponse(
        res,
        { user: AuthService.formatUser(user, true) },
        "Profile updated successfully",
      );
    } catch (error) {
      console.error("Update profile error:", error);
      if (error.message === "No valid updates provided")
        return errorResponse(res, error.message, 400);
      if (error.message === "User not found")
        return errorResponse(res, error.message, 404);
      return errorResponse(res, "Failed to update profile");
    }
  }

  static async changePassword(req, res) {
    try {
      const { userId } = req;
      if (!userId) return unauthorizedResponse(res, "Authentication required");

      await AuthService.changePassword(userId, req.body || {});

      res.clearCookie(
        "refreshToken",
        CLEAR_COOKIE_OPTIONS(process.env.NODE_ENV === "production"),
      );
      return successResponse(res, null, "Password changed successfully");
    } catch (error) {
      console.error("Change password error:", error);
      if (
        [
          "Invalid credentials",
          "New password must be different from current password",
          "User not found",
        ].includes(error.message)
      ) {
        return errorResponse(res, error.message, 400);
      }
      return errorResponse(res, "Failed to change password");
    }
  }

  static async deactivateAccount(req, res) {
    try {
      const { userId } = req;
      if (!userId) return unauthorizedResponse(res, "Authentication required");

      await AuthService.deactivateAccount(userId, req.body?.password);

      res.clearCookie(
        "refreshToken",
        CLEAR_COOKIE_OPTIONS(process.env.NODE_ENV === "production"),
      );
      return successResponse(res, null, "Account deactivated successfully");
    } catch (error) {
      console.error("Deactivate account error:", error);
      if (["Invalid password", "User not found"].includes(error.message)) {
        return errorResponse(res, error.message, 400);
      }
      return errorResponse(res, "Failed to deactivate account");
    }
  }
}

module.exports = AuthController;
