const mongoose = require("mongoose");
const seedUsers = require("./adminUserSeeder");
require("dotenv").config();

const runAllSeeders = async () => {
  try {
    console.log("Starting database seeding...");

    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/url_shortener"
    );
    console.log("Connected to MongoDB");

    await seedUsers();

    console.log("All seeders completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
};

runAllSeeders();
