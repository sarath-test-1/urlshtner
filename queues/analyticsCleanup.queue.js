const { Queue } = require("bullmq");
const { connection } = require("../config/queueRedis");

const analyticsCleanupQueue = new Queue("analytics-cleanup", {
  connection,
});

module.exports = { analyticsCleanupQueue };
