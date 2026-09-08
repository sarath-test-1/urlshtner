const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "./.env") });

const { startCleanupJob } = require("./services/expiredUrlCleanup");
const mongoose = require("mongoose");
const { getRedisClient, connectRedis } = require("./config/redis");
const logger = require("./utils/logger");

const app = require("./app");
const connectDB = require("./config/database");

// Validate required environment variables
const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "BASE_URL",

  // "ADMIN_NAME",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",

  "MONGODB_URI",

  "REDIS_USERNAME",
  "REDIS_PASSWORD",
  "REDIS_HOST",
  "REDIS_PORT",

  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_EXPIRE",

  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX_REQUESTS",
  
  "SHORT_URL_LENGTH",
  "SERVER_NAME",



];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

console.log(missingEnvVars);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:");
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  process.exit(1);
}

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log("gracefulShutdown called");
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (!server) {
    logger.info("Server not yet started, exiting immediately");
    process.exit(0);
  }

  // Force exit after 10 seconds if graceful shutdown hangs
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000);

  // Prevent timer from keeping process alive
  forceExitTimer.unref();

  server.close(async () => {
    logger.info("HTTP server closed");
    console.log("HTTP server closed")

    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed");
       console.log("MongoDB connection closed")

      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.quit();
        logger.info("Redis connection closed");
         console.log("Redis connection closed")
      }

      // Flush Logtail logs before exit so nothing is lost
      if (process.env.LOGTAIL_TOKEN) {
        const { logtail } = require("./utils/logger");
        await logtail?.flush();
      }

      clearTimeout(forceExitTimer);
    } catch (err) {
      logger.error({ message: "Error during shutdown", error: err.message });
       console.log("Error during shutdown")
    } finally {
      process.exit(0);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Catch unhandled rejections and exceptions — last safety net
process.on("unhandledRejection", (reason) => {
  logger.error({
    message: "Unhandled promise rejection",
    error: reason?.message || reason,
  });
});

process.on("uncaughtException", (err) => {
  logger.error({
    message: "Uncaught exception",
    error: err.message,
    stack: err.stack,
  });
  gracefulShutdown("uncaughtException");
});

// Start server function
const startServer = async () => {
  try {
    console.log("Starting URL Shortener Server...");
    console.log(`Environment: ${process.env.NODE_ENV}`);
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("MongoDB connected successfully");

    // Connect to Redis
    console.log("Connecting to Redis...");
    try {
      await connectRedis();
      console.log("Redis connected successfully");
    } catch (error) {
      console.warn(
        "  Redis connection failed - continuing without cache:",
        error.message,
      );
    }

    // Start HTTP server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log("URL Shortener Server Ready!");
      console.log(`Server running on port: ${PORT}`);
      console.log(`Base URL: ${process.env.BASE_URL}`);
      console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
      console.log(`JSON Spec: http://localhost:${PORT}/api-docs.json`);
      console.log(`Health Check: ${process.env.BASE_URL}/health`);
      console.log("");
      console.log(" Available Endpoints:");
      console.log("   Authentication: /api/v1/auth");
      console.log("   URLs: /api/v1/urls");
      console.log("   Analytics: /api/v1/analytics");
      console.log("   Redirect: /:shortCode");
      console.log("");

      if (process.env.NODE_ENV === "development") {
        console.log(" Development Mode:");
        console.log("   - Detailed error messages enabled");
        console.log("   - CORS enabled for localhost");
        console.log("   - Rate limiting relaxed for admin users");
        console.log("");
      }

      // Store server reference for graceful shutdown
      global.server = server;
    });

    server.requestTimeout = 30000;    // max time to receive a full request (30s — 5min default is too generous for a URL shortener)
    // Node's 5-minute default is unnecessarily generous for your use case (URL creation/redirect/analytics endpoints)
    // 30s is more realistic and protects you from slow-client attacks tying up connections.
    
    server.headersTimeout = 35000;    // must be > requestTimeout; guards the slowloris attack vector
    server.keepAliveTimeout = 5000;   // how long to hold idle keep-alive sockets open

    return server;
  } catch (error) {
    console.error(" Failed to start server:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Cleanup function for expired URLs
startCleanupJob();

// Start the server
let server;
startServer()
  .then((serverInstance) => {
    server = serverInstance;
  })
  .catch((error) => {
    console.error("Server startup failed:", error);
    process.exit(1);
  });

// Export for testing purposes
module.exports = app;
