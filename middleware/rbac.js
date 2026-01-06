const {
  forbiddenResponse,
  unauthorizedResponse,
  notFoundResponse,
  errorResponse,
} = require("../utils/apiResponse");

/**
 * Check if user has required role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return unauthorizedResponse(res, "Authentication required");
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return forbiddenResponse(
        res,
        `Access denied. Required role: ${roles.join(" or ")}`
      );
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const requireAdmin = requireRole("admin");

/**
 * Check if user can access resource (owner or admin)
 */
const requireOwnershipOrAdmin = (resourceUserIdField = "userId") => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // Admin can access everything
      if (req.user.role === "admin") {
        return next();
      }

      // For other users, check ownership
      let resourceUserId;

      // Get resource user ID from different sources
      if (req.resource && req.resource[resourceUserIdField]) {
        resourceUserId = req.resource[resourceUserIdField].toString();
      } else if (req.body && req.body[resourceUserIdField]) {
        resourceUserId = req.body[resourceUserIdField].toString();
      } else if (req.params && req.params[resourceUserIdField]) {
        resourceUserId = req.params[resourceUserIdField].toString();
      }

      // If no resource user ID found, assume user is trying to access their own resources
      if (!resourceUserId) {
        return next();
      }

      // Check if user owns the resource
      if (resourceUserId !== req.userId) {
        return forbiddenResponse(
          res,
          "Access denied. You can only access your own resources"
        );
      }

      next();
    } catch (error) {
      console.error("Ownership check error:", error);
      return forbiddenResponse(res, "Access validation failed");
    }
  };
};

/**
 * Check if user can modify resource (owner or admin)
 */
const canModifyResource = (model, resourceIdParam = "id") => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return unauthorizedResponse(res, "Authentication required");
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return errorResponse(res, "Resource ID is required", 400);
      }

      // Find the resource
      const resource = await model.findById(resourceId);
      if (!resource) {
        return notFoundResponse(res, "Resource not found");
      }

      // Admin can modify everything
      if (req.user.role === "admin") {
        req.resource = resource;
        return next();
      }

      // Check if user owns the resource
      if (resource.userId && resource.userId.toString() !== req.userId) {
        return forbiddenResponse(
          res,
          "Access denied. You can only modify your own resources"
        );
      }

      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      console.error("Resource modification check error:", error);
      return forbiddenResponse(res, "Access validation failed");
    }
  };
};

/**
 * Rate limiting based on user role
 */
const roleBasedLimits = {
  user: {
    urlCreation: { max: 100, window: 24 * 60 * 60 * 1000 }, // 100 per day
    general: { max: 1000, window: 60 * 60 * 1000 }, // 1000 per hour
  },
  admin: {
    urlCreation: { max: 1000, window: 24 * 60 * 60 * 1000 }, // 1000 per day
    general: { max: 10000, window: 60 * 60 * 1000 }, // 10000 per hour
  },
};

/**
 * Get rate limit for user based on role
 */
const getRateLimit = (user, limitType = "general") => {
  if (!user) {
    return { max: 100, window: 60 * 60 * 1000 }; // Default for anonymous users
  }

  const role = user.role || "user";
  return roleBasedLimits[role]?.[limitType] || roleBasedLimits.user[limitType];
};

module.exports = {
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin,
  canModifyResource,
  getRateLimit,
};
