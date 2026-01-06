const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const compression = require("compression");
const logger = require("./utils/logger");
const requestId = require("./middleware/requestId");

// Import routes
const authRoutes = require("./routes/auth");
const urlRoutes = require("./routes/urls");
const userRoutes = require("./routes/users");
const analyticsRoutes = require("./routes/analytics");

// Import controllers
const UrlController = require("./controllers/urlController");

// Import middleware
const {
  urlAccessLimiter,
  generalLimiter,
} = require("./middleware/rateLimiter");

const { validateShortCode } = require("./request/validators/auth-validators");
const { errorResponse } = require("./utils/apiResponse");

// Create Express app
const app = express();

// Trust proxy (important for getting real IP addresses in production)
app.set("trust proxy", 1);

app.use(requestId);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", process.env.BASE_URL],
      },
    },
  })
);

app.use(
  compression({
    // Avoids wasting CPU on tiny responses
    threshold: 1024, // only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from localhost in development
    if (process.env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }

    // In production, configure allowed origins
    const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

morgan.token("id", (req) => req.requestId);
morgan.token("user", (req) => req.user?.id || "guest");

// logging middleware
const morganFormat = ":id :method :url :status :response-time ms user=:user";

app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
    skip: (req, res) =>
      process.env.NODE_ENV === "production" && res.statusCode < 400,
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API Routes with versioning
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/urls", urlRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// Serve static files from React build
app.use(express.static(path.join(__dirname, "dist")));

// Short URL redirect route (must be after API routes)
/**
 * @route GET /:shortCode
 * @desc Redirect to long URL
 * @access Public
 */
app.get(
  "/:shortCode",
  urlAccessLimiter,
  validateShortCode,
  UrlController.redirectToLongUrl
);

// 404 handler for API routes
// /api will match all requests starting with /api that didn’t match earlier routes.
// Use req.originalUrl instead of req.path to show the full path requested.
app.use("/api", (req, res) => {
  return errorResponse(
    res,
    `API endpoint not found: ${req.method} ${req.originalUrl}`,
    404
  );
});

app.use(require("./middleware/errorHandler"));
// Global error handler
// app.use((error, req, res, next) => {
//   console.error("Global error handler:", error);

//   // Handle different types of errors
//   if (error.name === "ValidationError") {
//     const errors = Object.values(error.errors).map((err) => ({
//       field: err.path,
//       message: err.message,
//     }));
//     return errorResponse(res, "Validation failed", 400, errors);
//   }

//   if (error.name === "CastError") {
//     return errorResponse(res, "Invalid ID format", 400);
//   }

//   if (error.code === 11000) {
//     const field = Object.keys(error.keyValue)[0];
//     return errorResponse(res, `${field} already exists`, 400);
//   }

//   if (error.name === "JsonWebTokenError") {
//     return errorResponse(res, "Invalid token", 401);
//   }

//   if (error.name === "TokenExpiredError") {
//     return errorResponse(res, "Token expired", 401);
//   }

//   // Default error response
//   const statusCode = error.statusCode || 500;
//   const message =
//     process.env.NODE_ENV === "production"
//       ? "Something went wrong"
//       : error.message;

//   return errorResponse(res, message, statusCode);
// });

module.exports = app;
