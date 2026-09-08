const { Queue } = require("bullmq");
const { connection } = require("../config/queueRedis");

const welcomeEmailQueue = new Queue("welcome-email", {
  connection,
  //   Prevents SMTP bans
  limiter: {
    max: 10, // 10 emails
    duration: 1000, // per second
  },
});

module.exports = { welcomeEmailQueue };
