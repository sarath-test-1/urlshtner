const Url = require("../../models/Url");
const { generateUniqueId, generateUniqueShortCode } = require("./testHelpers");

/**
 * Create a test URL in the database
 */
const createTestUrl = async (userId, urlData = {}) => {
  const uniqueId = generateUniqueId();
  const defaultUrlData = {
    longUrl: `https://example${uniqueId}.com`,
    shortCode: generateUniqueShortCode(),
    userId: userId,
    title: `Test URL ${uniqueId}`,
    description: `Test description ${uniqueId}`,
    clickCount: 0,
    isActive: true,
  };

  const url = new Url({ ...defaultUrlData, ...urlData });
  await url.save({ validateBeforeSave: false });
  return url;
};

/**
 * Create multiple test URLs for pagination testing
 */
const createMultipleTestUrls = async (userId, count = 5) => {
  const urls = [];
  for (let i = 0; i < count; i++) {
    const url = await createTestUrl(userId, {
      longUrl: `https://example${i}.com`,
      shortCode: generateUniqueShortCode(),
      title: `Test URL ${i}`,
      clickCount: i * 10, // Different click counts for sorting tests
    });
    urls.push(url);
    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return urls;
};

module.exports = {
  createTestUrl,
  createMultipleTestUrls,
};
