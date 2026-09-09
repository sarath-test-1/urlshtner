const { query } = require("express-validator");

/**
 * Pagination validation
 */
const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("sort_by")
    .optional()
    .isIn(["name", "created_at"])
    .withMessage("Sort by must be one of: name, created_at"),

  query("sort_order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),

  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must be a string up to 100 characters"),
];

/**
 * Pagination validation
 */
const validateUrlsPagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("sort_by")
    .optional()
    .isIn(["click_count", "expires_at", "created_at"])
    .withMessage("Sort by must be one of: click_count, expires_at, created_at"),

  query("sort_order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),

  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must be a string up to 100 characters"),
];

module.exports = {
  validatePagination,
  validateUrlsPagination,
};
