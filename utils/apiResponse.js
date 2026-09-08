/**
 * Standard API Response utility
 */
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.status_code = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

class ListingApiResponse {
  constructor(statusCode, data, meta, message = "Success") {
    this.status_code = statusCode;
    this.data = data;
    this.meta = meta;
    this.message = message;
    this.success = statusCode < 400;
  }
}

/**
 * Success response helper
 */
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, data, message));
};

/**
 * Listing Success response helper
 */
const listingSuccessResponse = (
  res,
  data,
  meta,
  message = "Success",
  statusCode = 200
) => {
  return res
    .status(statusCode)
    .json(new ListingApiResponse(statusCode, data, meta, message));
};

/**
 * Error response helper
 */
const errorResponse = (
  res,
  message = "Something went wrong",
  statusCode = 500,
  errors = null
) => {
  const response = new ApiResponse(statusCode, null, message);
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

/**
 * Validation error response helper
 */
const validationErrorResponse = (res, errors) => {
  return errorResponse(res, "The given data was invalid.", 422, errors);
};

/**
 * Not found response helper
 */
const notFoundResponse = (res, message = "Resource not found") => {
  return errorResponse(res, message, 404);
};

/**
 * Unauthorized response helper
 */
const unauthorizedResponse = (res, message = "Unauthorized") => {
  return errorResponse(res, message, 401);
};

/**
 * Forbidden response helper
 */
const forbiddenResponse = (res, message = "Forbidden") => {
  return errorResponse(res, message, 403);
};

module.exports = {
  ApiResponse,
  ListingApiResponse,
  successResponse,
  listingSuccessResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
};
