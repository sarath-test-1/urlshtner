require("dotenv").config();
const { Worker } = require("bullmq");
const { connection } = require("../config/queueRedis");
const { sendWelcomeEmail } = require("../services/mailService");

const worker = new Worker(
  "welcome-email",
  async (job) => {
    const { email, name } = job.data;
    await sendWelcomeEmail(email, name);
  },
  {
    connection,
    concurrency: 5, // max 5 emails at once
  }
);

worker.on("failed", (job, err) => {
  console.error(
    `[WELCOME_EMAIL_FAILED] Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts`,
    err.message
  );
});
