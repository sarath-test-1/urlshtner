const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const compression = require("compression");
const logger = require("./utils/logger");
const requestId = require("./middleware/requestId");
const httpLogger = require("./middleware/httpLogger");
const handleValidationErrors = require("./middleware/validation");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

// Import routes
const authRoutes = require("./routes/v1/auth");
const urlRoutes = require("./routes/v1/urls");
const userRoutes = require("./routes/v1/users");
const analyticsRoutes = require("./routes/v1/analytics");

// Import controllers
const UrlController = require("./controllers/v1/urlController");

// Import middleware
const {
  urlAccessLimiter,
  generalLimiter,
} = require("./middleware/rateLimiter");

const { validateShortCode } = require("./request/validators/v1/url-validators");
const { errorResponse } = require("./utils/apiResponse");

const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { welcomeEmailQueue } = require("./queues/welcomeEmail.queue");
const { requireAdmin } = require("./middleware/auth");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(welcomeEmailQueue),
    // add more queues here
  ],
  serverAdapter,
});

// Create Express app
const app = express();

// Trust proxy (important for getting real IP addresses in production)
app.set("trust proxy", 1);

app.use(requestId);
app.use(httpLogger);

app.use("/admin/queues", requireAdmin, serverAdapter.getRouter());

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
  }),
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
  }),
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
      const AppError = require("./utils/AppError");
      callback(new AppError("Not allowed by CORS", 403, "CORS_ERROR"));
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

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
  handleValidationErrors,
  UrlController.redirectToLongUrl,
);

// 404 handler for API routes
// /api will match all requests starting with /api that didn’t match earlier routes.
// Use req.originalUrl instead of req.path to show the full path requested.
app.use("/api", (req, res) => {
  return errorResponse(
    res,
    `API endpoint not found: ${req.method} ${req.originalUrl}`,
    404,
  );
});

app.use(require("./middleware/errorHandler"));

module.exports = app;
