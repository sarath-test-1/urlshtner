const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const { errorResponse } = require("../utils/apiResponse");
const { getRateLimit } = require("./rbac");

/**
 * Create rate limiter with custom options
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Max request allowed with in the time window
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return errorResponse(
        res,
        "Too many requests, please try again later",
        429
      );
    },
    skip: (req) => {
      // Skip rate limiting for admin users in development
      if (
        process.env.NODE_ENV === "development" &&
        req.user?.role === "admin"
      ) {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.userId || ipKeyGenerator(req.ip); // Safe IP handling;
    },
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * General API rate limiter
 */
const generalLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    if (req.user) {
      const limits = getRateLimit(req.user, "general");
      return limits.max;
    }
    return 100; // Anonymous users
  },
  message: "Too many API requests, please try again later",
});

/**
 * URL creation rate limiter
 */
const urlCreationLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req) => {
    if (req.user) {
      const limits = getRateLimit(req.user, "urlCreation");
      return limits.max;
    }
    return 10; // Anonymous users get very limited access
  },
  message:
    "URL creation limit exceeded. Please try again tomorrow or upgrade your account",
});

/**
 * Authentication rate limiter (stricter)
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req, res) => ipKeyGenerator(req.ip), // Safe IP handling
});

/**
 * Registration rate limiter
 */
const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: "Too many registration attempts, please try again later",
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: "Too many password reset attempts, please try again later",
});

/**
 * URL access rate limiter (for redirect endpoint)
 */
const urlAccessLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 redirects per minute per IP
  message: "Too many URL accesses, please slow down",

  // req.ip alone is unsafe for IPv6.
  // ipKeyGenerator ensures consistent representation of IPs.
  keyGenerator: (req, res) => ipKeyGenerator(req.ip), // Safe IP handling
});

/**
 * Search rate limiter
 */
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: "Too many search requests, please slow down",
});

/**
 * Analytics rate limiter
 */
const analyticsLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 analytics requests per minute
  message: "Too many analytics requests, please slow down",
});

/**
 * Bulk operations rate limiter
 */
const bulkOperationsLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 bulk operations per 5 minutes
  message: "Too many bulk operations, please try again later",
});

module.exports = {
  generalLimiter,
  urlCreationLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  urlAccessLimiter,
  searchLimiter,
  analyticsLimiter,
  bulkOperationsLimiter,
  createRateLimiter,
};
