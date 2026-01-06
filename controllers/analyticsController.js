const { validationResult } = require("express-validator");
const AnalyticsService = require("../services/analyticsService");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
} = require("../utils/apiResponse");

class AnalyticsController {
  /**
   * Get user analytics dashboard
   */
  static async getUserAnalytics(req, res) {
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
      const timeRange = {};

      if (req.query.start_date && req.query.end_date) {
        timeRange.startDate = req.query.start_date;
        timeRange.endDate = req.query.end_date;
      }

      const analytics = await AnalyticsService.getUserAnalytics(
        userId,
        timeRange
      );

      return successResponse(
        res,
        analytics,
        "User analytics retrieved successfully"
      );
    } catch (error) {
      console.error("Get user analytics error:", error);
      return errorResponse(
        res,
        error.message || "Failed to get user analytics"
      );
    }
  }

  /**
   * Get admin analytics dashboard
   */
  static async getAdminAnalytics(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const timeRange = {};

      if (req.query.start_date && req.query.end_date) {
        timeRange.startDate = req.query.start_date;
        timeRange.endDate = req.query.end_date;
      }

      const analytics = await AnalyticsService.getAdminAnalytics(timeRange);

      return successResponse(
        res,
        analytics,
        "Admin analytics retrieved successfully"
      );
    } catch (error) {
      console.error("Get admin analytics error:", error);
      return errorResponse(
        res,
        error.message || "Failed to get admin analytics"
      );
    }
  }
}

module.exports = AnalyticsController;
