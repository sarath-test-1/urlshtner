const express = require("express");
const UserController = require("../../controllers/v1/userController");
const { authenticateToken } = require("../../middleware/auth");
const handleValidationErrors = require("../../middleware/validation");
const { requireAdmin } = require("../../middleware/rbac");

const {
  validateUserId,
  validateUserUpdate,
} = require("../../request/validators/v1/user-validators");
const {
  validatePagination,
} = require("../../request/validators/v1/pagination-validators");
const {
  generalLimiter,
} = require("../../middleware/rateLimiter");

const router = express.Router();

/**
 * @route get /api/v1/users
 * @desc Get list of paginated users
 * @access Private
 */
router.get(
  "/",
  generalLimiter,
  authenticateToken,
  validatePagination,
  handleValidationErrors,
  requireAdmin,
  UserController.getUsers,
);

/**
 * @route get /api/v1/users/:id
 * @desc Get user
 * @access Private
 */
router.get(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUserId,
  handleValidationErrors,
  requireAdmin,
  UserController.getUserDetails,
);

/**
 * @route patch /api/v1/users/:id
 * @desc Update user
 * @access Private
 */
router.patch(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUserUpdate,
  handleValidationErrors,
  requireAdmin,
  UserController.updateUser,
);

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user
 * @access Private (Owner or Admin)
 */
router.delete(
  "/:id",
  generalLimiter,
  authenticateToken,
  validateUserId,
  handleValidationErrors,
  requireAdmin,
  UserController.deleteUser,
);

module.exports = router;
