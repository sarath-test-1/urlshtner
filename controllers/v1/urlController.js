const UAParser = require("ua-parser-js");
const requestIp = require("request-ip");
const geoip = require("geoip-lite");
const { recordClickQueue } = require("../../queues/recordClick.queue");

const UrlService = require("../../services/v1/urlService");
const {
  successResponse,
  listingSuccessResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
} = require("../../utils/apiResponse");

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
      const { long_url, title, description, expires_at } = req.body || {};

      const userId = req.userId;

      // Create short URL
      const url = await UrlService.createShortUrl(
        userId,
        long_url,
        { title, description },
        expires_at,
      );

      const response = {
        id: url._id,
        user_id: url.userId,
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
        201,
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
      recordClickQueue.add("record", {
        shortCode,
        urlData,
        clientInfo,
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
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      const SORT_FIELD_MAP = {
        click_count: "clickCount",
        expires_at: "expiresAt",
        created_at: "createdAt",
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        search: req.query.search || "",
        sortBy: SORT_FIELD_MAP[req.query.sort_by] || "createdAt",
        sortOrder: req.query.sort_order || "desc",
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

      return listingSuccessResponse(
        res,
        formattedUrls,
        result.meta,
        "URLs retrieved successfully",
      );
    } catch (error) {
      console.error("Get user URLs error:", error);
      return errorResponse(res, error.message || "Failed to get URLs");
    }
  }

  static async getUrlDetails(req, res) {
    try {
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // URL is already fetched and attached by requireOwnership middleware
      const url = req.resource;

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
        "URL details retrieved successfully",
      );
    } catch (error) {
      console.error("Get URL details error:", error);

      return errorResponse(res, error.message || "Failed to get URL details");
    }
  }

  /**
   * Update URL
   */
  static async updateUrl(req, res) {
    try {
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
      return errorResponse(res, error.message || "Failed to update URL");
    }
  }

  /**
   * Delete URL
   */
  static async deleteUrl(req, res) {
    try {
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // URL is already fetched and attached by requireOwnership middleware
      const url = req.resource;

      await UrlService.deleteUrl(url, req.user);

      return res.status(204).send();
    } catch (error) {
      console.error("Delete URL error:", error);
      return errorResponse(res, error.message || "Failed to delete URL");
    }
  }

  /**
   * Bulk delete URLs
   */
  static async bulkDeleteUrls(req, res) {
    try {
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      const urls = req.resources;

      const result = await UrlService.bulkDeleteUrls(urls, userId);

      return successResponse(
        res,
        { deletedCount: result.deletedCount },
        result.message,
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
      const userId = req.userId;
      if (!userId) {
        return unauthorizedResponse(res, "Authentication required");
      }

      // URL is already fetched and attached by requireOwnership middleware
      const url = req.resource;

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
      return errorResponse(res, error.message || "Failed to update URL status");
    }
  }
}

module.exports = UrlController;
