const express = require("express");
const UrlController = require("../controllers/urlController");
const { authenticateToken, optionalAuth } = require("../middleware/auth");
const { requireAdmin, canModifyResource } = require("../middleware/rbac");
const handleValidationErrors = require("../middleware/validation");
const {
  urlCreationLimiter,
  urlAccessLimiter,
  searchLimiter,
  bulkOperationsLimiter,
  generalLimiter,
} = require("../middleware/rateLimiter");
const {
  validateUrlCreation,
  validateShortCode,
  validateBulkDelete,
} = require("../request/validators/auth-validators");

const {
  validatePagination,
} = require("../request/validators/pagination-validators");

const router = express.Router();

/**
 * @route POST /api/v1/urls
 * @desc Create a new short URL
 * @access Private
 */
router.post(
  "/",
  authenticateToken,
  urlCreationLimiter,
  validateUrlCreation,
  handleValidationErrors,
  UrlController.createShortUrl
);

/**
 * @route GET /api/v1/urls
 * @desc Get user's URLs with pagination and search
 * @access Private
 */
router.get(
  "/",
  authenticateToken,
  generalLimiter,
  validatePagination,
  handleValidationErrors,
  UrlController.getUserUrls
);

/**
 * @route GET /api/v1/urls/:id
 * @desc Get URL details
 * @access Private
 */
router.get(
  "/:id",
  authenticateToken,
  generalLimiter,
  UrlController.getUrlDetails
);

/**
 * @route patch /api/v1/urls/:id
 * @desc Update URL
 * @access Private (Owner or Admin)
 */
router.patch(
  "/:id",
  authenticateToken,
  generalLimiter,
  canModifyResource(require("../models/Url")),
  UrlController.updateUrl
);

/**
 * @route POST /api/v1/urls/bulk-delete
 * @desc Bulk delete URLs
 * @access Private
 */
router.delete(
  "/bulk-delete",
  authenticateToken,
  bulkOperationsLimiter,
  validateBulkDelete,
  handleValidationErrors,
  UrlController.bulkDeleteUrls
);

/**
 * @route DELETE /api/v1/urls/:id
 * @desc Delete URL
 * @access Private (Owner or Admin)
 */
router.delete(
  "/:id",
  authenticateToken,
  generalLimiter,
  canModifyResource(require("../models/Url")),
  UrlController.deleteUrl
);

/**
 * @route PATCH /api/v1/urls/:id/toggle
 * @desc Toggle URL active status
 * @access Private (Owner or Admin)
 */
router.patch(
  "/:id/toggle",
  authenticateToken,
  generalLimiter,
  canModifyResource(require("../models/Url")),
  UrlController.toggleUrlStatus
);

module.exports = router;
