const { validationResult } = require("express-validator");
const UAParser = require("ua-parser-js");
const requestIp = require("request-ip");
const geoip = require("geoip-lite");

const UrlService = require("../services/urlService");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
} = require("../utils/apiResponse");

// Helper function to extract client info from request
const extractClientInfo = (req) => {
  // Get client IP (IPv4 or IPv6-safe)
  const ip = requestIp.getClientIp(req);

  // Normalize IPv6 localhost & IPv4-mapped IPv6
  const normalizedIp =
    ip === "::1"
      ? "127.0.0.1"
      : ip?.startsWith("::ffff:")
      ? ip.replace("::ffff:", "")
      : ip;

  // Parse user-agent
  const parser = new UAParser(req.headers["user-agent"]);
  const ua = parser.getResult();

  // Geo lookup
  const geo = normalizedIp ? geoip.lookup(normalizedIp) : null;

  return {
    ipAddress: normalizedIp || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
    referrer: req.headers.referer || "",
    device: ua.device.type || "desktop",
    browser: ua.browser.name || "Unknown",
    os: ua.os.name || "Unknown",
    country: geo?.country || "Unknown",
    city: geo?.city || "Unknown",
  };
};

class UrlController {
  static async createShortUrl(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const { long_url, title, description, expires_at } = req.body;

      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // Create short URL
      const url = await UrlService.createShortUrl(
        userId,
        long_url,
        { title, description },
        expires_at
      );

      const response = {
        id: url._id,
        short_code: url.shortCode,
        short_url: `${process.env.BASE_URL}/${url.shortCode}`,
        long_url: url.longUrl,
        title: url.title,
        description: url.description,
        click_count: url.clickCount,
        is_active: url.isActive,
        expires_at: url.expiresAt,
        created_at: url.createdAt,
      };

      return successResponse(
        res,
        response,
        "Short URL created successfully",
        201
      );
    } catch (error) {
      console.error("Create short URL error:", error);
      return errorResponse(res, error.message || "Failed to create short URL");
    }
  }

  /**
   * Redirect to long URL
   */
  static async redirectToLongUrl(req, res) {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        return notFoundResponse(res, "Short code is required");
      }

      // Get long URL
      const urlData = await UrlService.getLongUrl(shortCode);

      if (!urlData) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1 class="error">Link Not Found</h1>
            <p>The short link you're looking for doesn't exist or has expired.</p>
            <p><a href="/">Go to Homepage</a></p>
          </body>
          </html>
        `);
      }

      // Extract client info for analytics
      const clientInfo = extractClientInfo(req);

      console.log(clientInfo);

      // Record click analytics (non-blocking)
      UrlService.recordClick(shortCode, urlData, clientInfo).catch((error) => {
        console.error("Analytics recording error:", error);
      });

      // Perform 302 redirect for analytics tracking
      return res.redirect(302, urlData.long_url);
    } catch (error) {
      console.error("Redirect error:", error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Server Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">Server Error</h1>
          <p>Something went wrong. Please try again later.</p>
          <p><a href="/">Go to Homepage</a></p>
        </body>
        </html>
      `);
    }
  }

  static async getUserUrls(req, res) {
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
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        search: req.query.search || "",
        sortBy: req.query.sortBy || "createdAt",
        sortOrder: req.query.sortOrder || "desc",
      };

      const result = await UrlService.getUserUrls(userId, options);

      // Format URLs for response
      const formattedUrls = result.urls.map((url) => ({
        id: url._id,
        shortCode: url.shortCode,
        shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
        longUrl: url.longUrl,
        title: url.title,
        description: url.description,
        clickCount: url.clickCount,
        isActive: url.isActive,
        expiresAt: url.expiresAt,
        lastAccessedAt: url.lastAccessedAt,
        createdAt: url.createdAt,
        updatedAt: url.updatedAt,
      }));

      const response = {
        urls: formattedUrls,
        pagination: result.pagination,
      };

      return successResponse(res, response, "URLs retrieved successfully");
    } catch (error) {
      console.error("Get user URLs error:", error);
      return errorResponse(res, error.message || "Failed to get URLs");
    }
  }

  static async getUrlDetails(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      if (!id) {
        return errorResponse(res, "URL ID is required", 400);
      }

      const url = await UrlService.getUrlDetails(id, userId);

      const response = {
        id: url._id,
        short_code: url.shortCode,
        short_url: `${process.env.BASE_URL}/${url.shortCode}`,
        long_url: url.longUrl,
        title: url.title,
        description: url.description,
        click_count: url.clickCount,
        is_active: url.isActive,
        expires_at: url.expiresAt,
        last_accessed_at: url.lastAccessedAt,
        created_at: url.createdAt,
        updated_at: url.updatedAt,
      };

      return successResponse(
        res,
        response,
        "URL details retrieved successfully"
      );
    } catch (error) {
      console.error("Get URL details error:", error);

      if (error.message === "URL not found") {
        return notFoundResponse(res, "URL not found");
      }

      return errorResponse(res, error.message || "Failed to get URL details");
    }
  }

  /**
   * Update URL
   */
  static async updateUrl(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationErrorResponse(res, errors.array());
      }

      const updateData = req.body;

      const url = await UrlService.updateUrl(req.resource, updateData);

      const response = {
        id: url._id,
        short_code: url.shortCode,
        short_url: `${process.env.BASE_URL}/${url.shortCode}`,
        long_url: url.longUrl,
        title: url.title,
        description: url.description,
        click_count: url.clickCount,
        is_active: url.isActive,
        expires_at: url.expiresAt,
        last_accessed_at: url.lastAccessedAt,
        created_at: url.createdAt,
        updated_at: url.updatedAt,
      };

      return successResponse(res, response, "URL updated successfully");
    } catch (error) {
      console.error("Update URL error:", error);

      if (error.message === "URL not found") {
        return notFoundResponse(res, "URL not found");
      }

      return errorResponse(res, error.message || "Failed to update URL");
    }
  }

  static async deleteUrl(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      if (!id) {
        return errorResponse(res, "URL ID is required", 400);
      }

      const result = await UrlService.deleteUrl(id, userId);

      return res.status(204).send();
    } catch (error) {
      console.error("Delete URL error:", error);

      if (error.message === "URL not found") {
        return notFoundResponse(res, "URL not found");
      }

      return errorResponse(res, error.message || "Failed to delete URL");
    }
  }

  /**
   * Bulk delete URLs
   */
  static async bulkDeleteUrls(req, res) {
    try {
      const { url_ids } = req.body;
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      if (!url_ids || !Array.isArray(url_ids) || url_ids.length === 0) {
        return errorResponse(res, "URL IDs array is required", 400);
      }

      if (url_ids.length > 50) {
        return errorResponse(
          res,
          "Cannot delete more than 50 URLs at once",
          400
        );
      }

      const result = await UrlService.bulkDeleteUrls(url_ids, userId);

      return successResponse(
        res,
        { deletedCount: result.deletedCount },
        result.message
      );
    } catch (error) {
      console.error("Bulk delete URLs error:", error);
      return errorResponse(res, error.message || "Failed to delete URLs");
    }
  }

  /**
   * Toggle URL status (activate/deactivate)
   */
  static async toggleUrlStatus(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      if (!id) {
        return errorResponse(res, "URL ID is required", 400);
      }

      const url = await UrlService.getUrlDetails(id, userId);
      const updatedUrl = await UrlService.updateUrl(url, {
        is_active: !url.isActive,
      });

      const response = {
        id: updatedUrl._id,
        short_code: updatedUrl.shortCode,
        is_active: updatedUrl.isActive,
        message: updatedUrl.isActive ? "URL activated" : "URL deactivated",
      };

      return successResponse(res, response, "URL status updated successfully");
    } catch (error) {
      console.error("Toggle URL status error:", error);

      if (error.message === "URL not found") {
        return notFoundResponse(res, "URL not found");
      }

      return errorResponse(res, error.message || "Failed to update URL status");
    }
  }
}

module.exports = UrlController;
