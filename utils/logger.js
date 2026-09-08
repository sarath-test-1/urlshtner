const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");
const path = require("path");
const { scrubObject, scrubString } = require("./sanitizeLog");

const logDir = path.join(__dirname, "../logs");

// PII scrub format — runs before json()
const piiScrubFormat = format((info) => {
  if (typeof info.message === "string") {
    info.message = scrubString(info.message);
  }
  const { level, message, timestamp, stack, ...meta } = info;
  return { level, message, timestamp, stack, ...scrubObject(meta) };
})();

const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  piiScrubFormat,
  format.json()
);

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  format: logFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      level: "error",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new transports.Console({
    format: format.combine(format.colorize(), format.simple()),
  }));
}

if (process.env.LOGTAIL_TOKEN) {
  const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
  logger.add(new LogtailTransport(logtail, { level: "http" }));
}

module.exports = logger;

// const { createLogger, format, transports } = require("winston");
// const DailyRotateFile = require("winston-daily-rotate-file");
// const { Logtail } = require("@logtail/node");
// const { LogtailTransport } = require("@logtail/winston");
// const path = require("path");

// const logDir = path.join(__dirname, "../logs");

// const logFormat = format.combine(
//   format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//   format.errors({ stack: true }),
//   format.json(),
// );

// const logger = createLogger({
//   level: process.env.NODE_ENV === "production" ? "info" : "debug",
//   levels: {
//     error: 0,
//     warn: 1,
//     info: 2,
//     http: 3,
//     debug: 4,
//   },
//   format: logFormat,
//   transports: [
//     // Terminal logs

//     // REMOVE LATER IF EVERYTHING WORKS WELL
//     // new transports.Console({
//     //   level: "http",
//     //   format: format.combine(format.colorize(), format.simple()),
//     // }),

//     new DailyRotateFile({
//       filename: path.join(logDir, "app-%DATE%.log"),
//       datePattern: "YYYY-MM-DD",
//       maxSize: "20m",
//       maxFiles: "14d",
//     }),

//     new DailyRotateFile({
//       filename: path.join(logDir, "error-%DATE%.log"),
//       level: "error",
//       datePattern: "YYYY-MM-DD",
//       maxSize: "20m",
//       maxFiles: "30d",
//     }),
//   ],
// });

// if (process.env.NODE_ENV !== "production") {
//   logger.add(
//     new transports.Console({
//       format: format.combine(format.colorize(), format.simple()),
//     }),
//   );
// }

// if (process.env.LOGTAIL_TOKEN) {
//   const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

//   // This will automatically include:
//   // http
//   // info
//   // warn
//   // error
//   logger.add(new LogtailTransport(logtail, { level: "http" }));
// }

// module.exports = logger;
