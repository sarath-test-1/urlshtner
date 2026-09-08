const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validate url ID parameter
 */
const validateUrlId = [
  param("id")
    .notEmpty()
    .withMessage("Url ID is required")
    .isMongoId()
    .withMessage("Invalid Url ID format"),
];

/**
 * URL creation validation
 */
const validateUrlCreation = [
  body("title")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters")
    .bail(),

  // Description (optional)
  body("description")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .bail(),

  body("long_url")
    .trim()
    .notEmpty()
    .withMessage("URL is required")
    .bail()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage("Please provide a valid URL with http or https protocol")
    .bail()
    .isLength({ max: 2048 })
    .withMessage("URL is too long (maximum 2048 characters)")
    .bail(),

  body("expires_at")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date")
    .bail()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiration date must be in the future");
      }
      return true;
    })
    .bail(),
];

/**
 * Short code parameter validation
 */
const validateShortCode = [
  param("shortCode")
    .trim()
    .notEmpty()
    .withMessage("shortCode is required")
    .bail()
    .isLength({ min: 1, max: 20 })
    .withMessage("Short code must be between 1 and 20 characters")
    .bail()
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage("Short code can only contain letters and numbers"),
];

const validateBulkDeleteUrls = [
  body("url_ids")
    .notEmpty()
    .withMessage("Url IDs are required")
    .bail()
    .isArray({ min: 1, max: 50 })
    .withMessage("URL IDs must be an array with 1–50 items")
    .bail()
    .custom((ids) => {
      if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new Error("All IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

/**
 * URL update validation
 */
const validateUrlUpdate = [
  param("id")
    .notEmpty()
    .withMessage("Url ID is required")
    .isMongoId()
    .withMessage("Invalid Url ID format"),

  body("long_url")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Long URL cannot be empty")
    .bail()
    .isLength({ max: 2048 })
    .withMessage("URL cannot exceed 2048 characters")
    .bail()
    .isURL({
      require_protocol: true,
      protocols: ["http", "https"],
      require_tld: true,
      allow_underscores: false,
    })
    .withMessage("Please provide a valid URL with http or https protocol")
    .bail(),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("expires_at")
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow null/empty to clear expiration

      const expiresAt = new Date(value);

      // Check if valid date
      if (isNaN(expiresAt.getTime())) {
        throw new Error("Invalid date format");
      }

      // Check if in the future
      if (expiresAt <= new Date()) {
        throw new Error("Expiration date must be in the future");
      }

      return true;
    }),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),

  // Ensure at least one field is being updated
  body("msg").custom((value, { req }) => {
    const allowedFields = [
      "long_url",
      "title",
      "description",
      "expires_at",
      "is_active",
    ];
    const providedFields = Object.keys(req.body);
    const hasValidUpdate = providedFields.some((field) =>
      allowedFields.includes(field)
    );

    if (!hasValidUpdate) {
      throw new Error("At least one valid field must be provided for update");
    }

    return true;
  }),
];

module.exports = {
  validateUrlCreation,
  validateUrlUpdate,
  validateShortCode,
  validateUrlId,
  validateBulkDeleteUrls,
};
