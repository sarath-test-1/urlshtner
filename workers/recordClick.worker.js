require("dotenv").config();
const { Worker } = require("bullmq");
const { connection } = require("../config/queueRedis");
const UrlService = require("../services/urlService");

new Worker(
  "record-click",
  async (job) => {
    const { shortCode, urlData, clientInfo } = job.data;

    if (!shortCode || !clientInfo) return;

    await UrlService.recordClick(shortCode, urlData, clientInfo);
  },
  {
    connection,
    removeOnComplete: true,
    removeOnFail: 100, // keep some failed jobs for debugging
  }
);
