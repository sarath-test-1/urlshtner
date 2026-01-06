const scanAndDelete = async (redisClient, pattern, batchSize = 100) => {
  let cursor = 0;

  do {
    const result = await redisClient.scan(cursor, {
      MATCH: pattern,
      COUNT: batchSize,
    });

    cursor = Number(result.cursor);

    if (result.keys.length > 0) {
      await redisClient.del(result.keys);
    }
  } while (cursor !== 0);
};

module.exports = { scanAndDelete };
