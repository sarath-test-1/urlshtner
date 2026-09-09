// Load test environment variables
require("dotenv").config({ path: ".env.test" });
const { closeConnection } = require("../../config/queueRedis");

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// Import database setup functions
const { setupTestDB, teardownTestDB, clearTestDB } = require("./testDb");

// Setup database before all tests
beforeAll(async () => {
  await setupTestDB();
});

// Clear database before each test to ensure isolation
beforeEach(async () => {
  await clearTestDB();
});

// Cleanup database after all tests
afterAll(async () => {
  await teardownTestDB();
  await closeConnection();
});

// Increase timeout for database operations
jest.setTimeout(30000);

// Suppress console.log during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

