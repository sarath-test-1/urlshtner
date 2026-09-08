const scanAndDelete = async (redisClient, pattern, batchSize = 100) => {
  let cursor = "0";

  while (true) {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      match: pattern,
      count: batchSize,
    });

    if (keys?.length) {
      await redisClient.del(keys);
    }

    // Upstash returns null when done
    if (!nextCursor || nextCursor === "0") break;

    cursor = nextCursor;
  }
};

module.exports = { scanAndDelete };
