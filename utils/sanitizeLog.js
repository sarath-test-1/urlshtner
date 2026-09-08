const crypto = require("crypto");

const PII_FIELDS = [
  "email",
  "password",
  "ipAddress",
  "name",
  "userAgent",
  "ip",
  "token",
];

const PII_PATTERNS = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL]",
  },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[IPv4]" },
];

function scrubObject(obj, depth = 0) {
  if (depth > 5 || typeof obj !== "object" || obj === null) return obj;

  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = scrubObject(value, depth + 1);
    } else if (typeof value === "string") {
      result[key] = scrubString(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function scrubString(str) {
  return PII_PATTERNS.reduce(
    (s, { pattern, replacement }) => s.replace(pattern, replacement),
    str,
  );
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHmac("sha256", process.env.LOG_HASH_SECRET || "dev-secret")
    .update(ip)
    .digest("hex")
    .substring(0, 16);
}

module.exports = { scrubObject, scrubString, hashIp };
