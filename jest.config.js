module.exports = {
  testEnvironment: "node",

  // Setup files to run before tests
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],

  // Test file patterns
  testMatch: ["<rootDir>/tests/**/*.test.js"],

  // Coverage configuration
  //   collectCoverageFrom: ["src/**/*.js", "!src/**/*.test.js", "!src/config/**"],

  // Coverage thresholds (optional)
  //   coverageThreshold: {
  //     global: {
  //       branches: 70,
  //       functions: 70,
  //       lines: 70,
  //       statements: 70,
  //     },
  //   },

  // Test timeout (increase for database operations)
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  //   resetMocks: true,
  //   restoreMocks: true,

  // Verbose output
  verbose: true,
  //   forceExit: true,
};
