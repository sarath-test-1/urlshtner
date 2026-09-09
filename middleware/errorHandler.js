const mongoose = require("mongoose");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const {
  errorResponse,
  validationErrorResponse,
} = require("../utils/apiResponse");

const errorHandler = (err, req, res, _next) => {
  // Normalize known Mongoose errors into AppError
  if (err instanceof mongoose.Error.CastError) {
    err = new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err = new AppError(`${field} already exists`, 400, "DUPLICATE_KEY");
  } else if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    logger.warn({
      message: "Validation error",
      path: req.path,
      method: req.method,
    });
    return validationErrorResponse(res, errors, "Validation failed");
  } else if (err.name === "JsonWebTokenError") {
    err = new AppError("Invalid token", 401, "INVALID_TOKEN");
  } else if (err.name === "TokenExpiredError") {
    err = new AppError("Token expired", 401, "TOKEN_EXPIRED");
  }

  // Log — operational errors are warn, unknown bugs are error
  const level = err.isOperational ? "warn" : "error";
  logger[level]({
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    method: req.method,
    path: req.path,
    userId: req.userId || null,
    // NO email, NO ip, NO userAgent here
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  if (err.isOperational) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // Unknown error — don't leak internals in production
  return errorResponse(
    res,
    process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : err.message,
    500,
  );
};

module.exports = errorHandler;

// const logger = require("../utils/logger");

// module.exports = (err, req, res, _next) => {
//   const statusCode = err.statusCode || 500;

//   logger.error("Request failed", {
//     requestId: req.requestId,
//     method: req.method,
//     url: req.originalUrl,
//     statusCode,
//     message: err.message,
//     stack: err.stack,
//   });

//   res.status(statusCode || 500).json({
//     success: false,
//     message: err.message || "Internal Server Error",
//     requestId: req.requestId,
//   });
// };
