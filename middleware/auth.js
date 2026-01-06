const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse, unauthorizedResponse } = require("../utils/apiResponse");

/**
 * Verify JWT token and authenticate user
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer token

    if (!token) {
      return unauthorizedResponse(res, "Access token is required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Find user and check if still active
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
      return unauthorizedResponse(res, "Invalid or expired token");
    }

    if (
      user.passwordChangedAt &&
      decoded.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      return unauthorizedResponse(res, "Token expired");
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return unauthorizedResponse(res, "Invalid token");
    } else if (error.name === "TokenExpiredError") {
      return unauthorizedResponse(res, "Token expired");
    } else {
      console.error("Auth middleware error:", error);
      return errorResponse(res, "Authentication failed");
    }
  }
};

/**
 * Verify refresh token from HTTP-only cookie
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return unauthorizedResponse(res, "Refresh token is required");
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return unauthorizedResponse(res, "Invalid refresh token");
    }

    // Attach user info
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      console.log(error);
      return unauthorizedResponse(res, "Invalid refresh token");
    } else if (error.name === "TokenExpiredError") {
      return unauthorizedResponse(res, "Refresh token expired");
    } else {
      console.error("Refresh token middleware error:", error);
      return errorResponse(res, "Refresh authentication failed");
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer token

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id.toString();
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, expiresIn = "15m") => {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresIn,
  });
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (userId, expiresIn = "15m") => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    {
      algorithm: "HS256",
      expiresIn: expiresIn,
    }
  );
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
