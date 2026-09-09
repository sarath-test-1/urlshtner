const express = require("express");
const AnalyticsController = require("../../controllers/v1/analyticsController");
const { authenticateToken } = require("../../middleware/auth");
const { requireAdmin } = require("../../middleware/rbac");
const handleValidationErrors = require("../../middleware/validation");
const {
  analyticsLimiter,
  generalLimiter,
} = require("../../middleware/rateLimiter");
const {
  validateAnalyticsTimeRange,
} = require("../../request/validators/v1/auth-validators");

const router = express.Router();

/**
 * @route GET /api/v1/analytics/user
 * @desc Get user analytics for dashboard
 * @access Private
 */
router.get(
  "/user",
  analyticsLimiter,
  authenticateToken,
  validateAnalyticsTimeRange,
  handleValidationErrors,
  AnalyticsController.getUserAnalytics,
);

/**
 * @route GET /api/v1/analytics/admin
 * @desc Get admin analytics for dashboard
 * @access Private (Admin)
 */
router.get(
  "/admin",
  analyticsLimiter,
  authenticateToken,
  validateAnalyticsTimeRange,
  handleValidationErrors,
  requireAdmin,
  AnalyticsController.getAdminAnalytics,
);

module.exports = router;
