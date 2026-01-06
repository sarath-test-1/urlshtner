const express = require("express");
const UserController = require("../controllers/userController");
const { authenticateToken } = require("../middleware/auth");
const handleValidationErrors = require("../middleware/validation");
const { requireAdmin } = require("../middleware/rbac");
const { authLimiter } = require("../middleware/rateLimiter");
const { validateUserUpdate } = require("../request/validators/user-validators");
const {
  validatePagination,
} = require("../request/validators/pagination-validators");
const {
  urlCreationLimiter,
  urlAccessLimiter,
  searchLimiter,
  bulkOperationsLimiter,
  generalLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * @route GET /api/v1/users
 * @desc Get users with pagination and search
 * @access Private
 */
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  generalLimiter,
  validatePagination,
  handleValidationErrors,
  UserController.getUsers
);

/**
 * @route GET /api/v1/users/:id
 * @desc Get user details
 * @access Private
 */
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  generalLimiter,
  UserController.getUserDetails
);

/**
 * @route patch /api/v1/users/:id
 * @desc Update user
 * @access Private
 */
router.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  generalLimiter,
  validateUserUpdate,
  handleValidationErrors,
  UserController.updateUser
);

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user
 * @access Private (Owner or Admin)
 */
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  generalLimiter,
  UserController.deleteUser
);

module.exports = router;
