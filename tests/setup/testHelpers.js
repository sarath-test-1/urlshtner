const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { randomUUID, randomBytes } = require("crypto");

const generateUniqueShortCode = () => {
  return randomBytes(6).toString("hex").substring(0, 10); // 10 alphanumeric chars
};

/**
 * Generate unique username/email to avoid conflicts
 */
const generateUniqueId = () => {
  return randomUUID();
};

/**
 * Create a test user in the database
 */
const createTestUser = async (userData = {}) => {
  const uniqueId = generateUniqueId();
  const defaultUserData = {
    name: `test user`,
    email: `test${uniqueId}@example.com`,
    password: "TestPass&123",
    role: "user",
  };

  const user = new User({ ...defaultUserData, ...userData });
  await user.save();
  return user;
};

/**
 * Create an admin test user
 */
const createTestAdmin = async (adminData = {}) => {
  const uniqueId = generateUniqueId();
  const defaultAdminData = {
    name: `test admin`,
    email: `admin${uniqueId}@example.com`,
    password: "AdminPass&123",
    role: "admin",
  };

  const user = new User({ ...defaultAdminData, ...adminData });
  await user.save();
  return user;
};

/**
 * Generate a JWT token for testing
 */
const generateTestToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

/**
 * Create user and return with token
 */
const createUserWithToken = async (userData = {}) => {
  const user = await createTestUser(userData);
  const token = generateTestToken(user._id);
  return { user, token };
};

/**
 * Create admin and return with token
 */
const createAdminWithToken = async (userData = {}) => {
  const admin = await createTestAdmin(userData);
  const token = generateTestToken(admin._id);
  return { user: admin, token };
};

/**
 * Common test data
 */
const testUserData = {
  valid: {
    name: `test user`,
    email: `valid${Date.now()}@example.com`,
    password: "ValidPass&123",
  },

  invalidEmail: {
    name: `test user`,
    email: "invalid-email",
    password: "TestPass&123",
  },

  weakPassword: {
    name: `test user`,
    email: `test${Date.now()}@example.com`,
    password: "123", // Too short, no uppercase, no lowercase, no special chars
  },

  invalidUsername: {
    username: "ab", // Too short
    email: `test${Date.now()}@example.com`,
    password: "TestPass&123",
  },

  specialCharsUsername: {
    name: "test@user!", // Invalid characters
    email: `test${Date.now()}@example.com`,
    password: "TestPass&123",
  },
};

/**
 * Extract token from response
 */
const extractToken = (response) => {
  return response.body.data?.token;
};

/**
 * Create authorization header
 */
const authHeader = (token) => {
  return `Bearer ${token}`;
};

module.exports = {
  generateUniqueShortCode,
  generateUniqueId,
  createTestUser,
  createTestAdmin,
  generateTestToken,
  createUserWithToken,
  createAdminWithToken,
  testUserData,
  extractToken,
  authHeader,
};
