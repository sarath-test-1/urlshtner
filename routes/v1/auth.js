const express = require("express");
const AuthController = require("../../controllers/v1/authController");
const { authenticateToken, verifyRefreshToken } = require("../../middleware/auth");
const handleValidationErrors = require("../../middleware/validation");
const { requireAdmin } = require("../../middleware/rbac");
const {
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
} = require("../../middleware/rateLimiter");
const {
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  validateChangePassword,
  validateAccountDeactivation,
} = require("../../request/validators/v1/auth-validators");

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  "/register",
  registrationLimiter,
  validateUserRegistration,
  handleValidationErrors,
  AuthController.register,
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  "/login",
  authLimiter,
  validateUserLogin,
  handleValidationErrors,
  AuthController.login,
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user and clear refresh token
 * @access Private
 */
router.post("/logout", authenticateToken, AuthController.logout);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Private
 */
router.post("/refresh", verifyRefreshToken, AuthController.refreshToken);

/**
 * @route GET /api/v1/auth/me
 * @desc Get user details
 * @access Private
 */

router.get("/me", authenticateToken, AuthController.getUser);

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get("/profile", authenticateToken, AuthController.getProfile);

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put(
  "/profile",
  authenticateToken,
  validateProfileUpdate,
  handleValidationErrors,
  AuthController.updateProfile,
);

/**
 * @route PATCH /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.patch(
  "/change-password",
  passwordResetLimiter,
  authenticateToken,
  validateChangePassword,
  handleValidationErrors,
  AuthController.changePassword,
);

/**
 * @route PATCH /api/v1/auth/deactivate
 * @desc Deactivate user account
 * @access Private
 */
router.patch(
  "/deactivate",
  authenticateToken,
  validateAccountDeactivation,
  handleValidationErrors,
  AuthController.deactivateAccount,
);

module.exports = router;
