const mongoose = require("mongoose");
require("dotenv").config();

const resetDatabase = async () => {
  let exitCode = 0;
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/url_shortener"
    );

    console.log("Dropping database...");
    await mongoose.connection.db.dropDatabase();

    console.log("Database reset successfully!");
  } catch (error) {
    console.error("Error resetting database:", error.message);
    exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("Disconnected from MongoDB");
    process.exit(exitCode);
  }
};

if (require.main === module) {
  resetDatabase();
}

module.exports = resetDatabase;
