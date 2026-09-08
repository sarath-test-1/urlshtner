const logger = require("../utils/logger");
const { hashIp } = require("../utils/sanitizeLog");

const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    logger.http({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${Date.now() - start}ms`,
      userId: req.userId || null,
      ipHash: hashIp(req.ip), // hashed, not raw
      // NO email, NO userAgent
    });
  });

  next();
};

module.exports = httpLogger;
