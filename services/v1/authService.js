const User = require("../../models/User");
const { generateToken, generateRefreshToken } = require("../../middleware/auth");
const { welcomeEmailQueue } = require("../../queues/welcomeEmail.queue");
const { analyticsCleanupQueue } = require("../../queues/analyticsCleanup.queue");

class AuthService {
  /**
   * Register a new user
   */
  static async register(
    { name, email, password, role = "user" },
    requestingUser = null,
  ) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const userData = { name, email, password };

    // Prevent privilege escalation
    userData.role =
      role === "admin" && requestingUser?.role === "admin" ? "admin" : "user";

    const user = new User(userData);
    await user.save();

    await user.updateLastLogin();

    analyticsCleanupQueue.add("cleanup", {
      pattern: "analytics:admin:*",
    });

    welcomeEmailQueue.add(
      "send-welcome-email",
      { userId: user._id, email: user.email, name: user.name },
      {
        jobId: `welcome-email-${user._id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
      },
    );

    return user;
  }

  /**
   * Login user
   */
  static async login({ email, password }) {
    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    await user.updateLastLogin();

    return user;
  }

  /**
   * Change password
   */
  static async changePassword(userId, { current_password, new_password }) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new Error("User not found");

    const isCurrentPasswordValid = await user.comparePassword(current_password);
    if (!isCurrentPasswordValid) throw new Error("Invalid credentials");

    const isSamePassword = await user.comparePassword(new_password);
    if (isSamePassword)
      throw new Error("New password must be different from current password");

    user.password = new_password;
    user.passwordChangedAt = new Date();
    await user.save();
  }

  /**
   * Deactivate account
   */
  static async deactivateAccount(userId, password) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new Error("User not found");

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new Error("Invalid password");

    user.isActive = false;
    await user.save();
  }

  /**
   * Get user by ID (for profile/getUser)
   */
  static async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new Error("User not found");
    return user;
  }

  /**
   * Update profile
   */
  static async updateProfile(userId, updateData) {
    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid updates provided");
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) throw new Error("User not found");
    return user;
  }

  /**
   * Generate tokens for a user
   */
  static generateTokens(userId) {
    return {
      accessToken: generateToken(userId, "15m"),
      refreshToken: generateRefreshToken(userId, "30d"),
    };
  }

  /**
   * Format user for response
   */
  static formatUser(user, includeLastLogin = false) {
    const base = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
      total_urls: user.totalUrls,
      total_clicks: user.totalClicks,
    };

    if (includeLastLogin) base.last_login = user.lastLogin;

    return base;
  }
}

module.exports = AuthService;
