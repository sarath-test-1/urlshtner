const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * User registration validation
 */
const validateUserRegistration = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .bail()
    .matches(/^[\p{L}\s.'-]+$/u)
    // Why this regex?
    //     Allows:
    //         John Doe
    //         Mary-Jane
    //         O'Connor
    //         Dr. Smith
    //         José García
    //         Müller
    //         李明
    //     Blocks:
    //         numbers
    //         emojis (most)
    .withMessage("Name can only contain letters and spaces"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
    }),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
    .withMessage(
      "Password must include uppercase, lowercase, number, and symbol"
    ),
];

/**
 * User login validation
 */
const validateUserLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
    }),

  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Change Password validation
 */
const validateChangePassword = [
  body("current_password")
    .notEmpty()
    .withMessage("Current Password is required"),

  body("new_password")
    .notEmpty()
    .withMessage("New Password is required")
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
    .withMessage(
      "Password must include uppercase, lowercase, number, and symbol"
    ),

  body("password_confirmation")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .bail()
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage("Password confirmation does not match"),
];

/**
 * Deactivate Account
 */
const validateAccountDeactivation = [
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Profile update validation
 */
const validateProfileUpdate = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .bail()
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage("Name can only contain letters and spaces"),
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

/**
 * Analytics time range validation
 */
const validateAnalyticsTimeRange = [
  query("start_date")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  query("end_date")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (
        req.query.start_date &&
        new Date(value) <= new Date(req.query.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

const validateBulkDelete = [
  body("ids")
    .isArray({ min: 1 })
    .withMessage("IDs must be a non-empty array")
    .bail()
    .custom((ids) => {
      if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new Error("All IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateUrlCreation,
  validateShortCode,
  validateAnalyticsTimeRange,
  validateProfileUpdate,
  validateChangePassword,
  validateAccountDeactivation,
  validateBulkDelete,
};
