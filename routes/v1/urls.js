const express = require("express");
const Url = require("../../models/Url");
const UrlController = require("../../controllers/v1/urlController");
const { authenticateToken, strictOptionalAuth } = require("../../middleware/auth");
const {
  requireAdmin,
  requireOwnership,
  requireAllOwnership,
  canModifyResource,
} = require("../../middleware/rbac");
const handleValidationErrors = require("../../middleware/validation");
const {
  urlCreationLimiter,
  urlAccessLimiter,
  searchLimiter,
  bulkOperationsLimiter,
  generalLimiter,
} = require("../../middleware/rateLimiter");

const {
  validateUrlCreation,
  validateUrlId,
  validateUrlUpdate,
  validateBulkDeleteUrls,
} = require("../../request/validators/v1/url-validators.js");

const {
  validateUrlsPagination,
} = require("../../request/validators/v1/pagination-validators");

const router = express.Router();

/**
 * @route POST /api/v1/urls
 * @desc Create a new short URL
 * @access Private or Public
 */
router.post(
  "/",
  urlCreationLimiter,
  strictOptionalAuth,
  validateUrlCreation,
  handleValidationErrors,
  UrlController.createShortUrl,
);

/**
 * @route GET /api/v1/urls
 * @desc Get user's URLs with pagination and search
 * @access Private
 */
router.get(
  "/",
  generalLimiter,
  authenticateToken,
  validateUrlsPagination,
  handleValidationErrors,
  UrlController.getUserUrls,
);

/**
 * @route get /api/v1/urls/:id
 * @desc Get URL details
 * @access Private
 */
router.get(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUrlId,
  handleValidationErrors,
  requireOwnership(Url),
  UrlController.getUrlDetails,
);

/**
 * @route patch /api/v1/urls/:id
 * @desc Update URL
 * @access Private
 */
router.patch(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUrlUpdate,
  handleValidationErrors,
  requireOwnership(Url),
  UrlController.updateUrl,
);

/**
 * @route POST /api/v1/urls/bulk-delete
 * @desc Bulk delete URLs
 * @access Private
 */
router.delete(
  "/bulk-delete",
  bulkOperationsLimiter,
  authenticateToken,
  validateBulkDeleteUrls,
  handleValidationErrors,
  requireAllOwnership(Url),
  UrlController.bulkDeleteUrls,
);

/**
 * @route DELETE /api/v1/urls/:id
 * @desc Delete URL
 * @access Private
 */
router.delete(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUrlId,
  handleValidationErrors,
  requireOwnership(Url),
  UrlController.deleteUrl,
);

/**
 * @route PATCH /api/v1/urls/:id/toggle
 * @desc Toggle URL active status
 * @access Private
 */
router.patch(
  "/:id/toggle",
  generalLimiter,
  authenticateToken,
  validateUrlId,
  handleValidationErrors,
  requireOwnership(Url),
  UrlController.toggleUrlStatus,
);

module.exports = router;
