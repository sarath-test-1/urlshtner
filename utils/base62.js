// Base62 encoding: 0-9, a-z, A-Z (62 characters)
const BASE62_CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Check if a string is valid base62
 * @param {string} str - String to validate
 * @returns {boolean} - True if valid base62
 */
const isValidBase62 = (str) => {
  if (!str || typeof str !== "string") return false;
  return str.split("").every((char) => BASE62_CHARS.includes(char));
};

module.exports = {
  isValidBase62,
};
