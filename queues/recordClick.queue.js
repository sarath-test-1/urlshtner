const { Queue } = require("bullmq");
const { connection } = require("../config/queueRedis");

const recordClickQueue = new Queue("record-click", {
  connection,
});

module.exports = { recordClickQueue };
