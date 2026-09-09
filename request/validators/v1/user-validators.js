const { body, param } = require("express-validator");

/**
 * Validate user ID parameter
 */
const validateUserId = [
  param("id")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),
];

/**
 * User update validation
 */
const validateUserUpdate = [
  param("id")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .bail()
    .matches(/^[\p{L}\s.'-]+$/u)
    .withMessage(
      "Name can only contain letters, spaces, and basic punctuation"
    ),
];

module.exports = {
  validateUserId,
  validateUserUpdate,
};
