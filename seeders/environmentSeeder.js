const User = require("../models/User");

const getSeederData = () => {
  const env = process.env.NODE_ENV || "development";

  const seedData = {
    production: [
      {
        name: "admin",
        email: "admin@yourcompany.com",
        password: process.env.ADMIN_PASSWORD,
        role: "admin",
        isActive: true,
      },
    ],

    development: [
      {
        name: "admin",
        email: "admin@dev.local",
        password: "dev123456",
        role: "admin",
        isActive: true,
      },
      {
        name: "testuser",
        email: "test@dev.local",
        password: "test123456",
        role: "user",
        isActive: true,
      },
      {
        name: "inactiveuser",
        email: "inactive@dev.local",
        password: "inactive123",
        role: "user",
        isActive: false,
      },
    ],

    test: [
      {
        name: "testadmin",
        email: "admin@test.local",
        password: "test123456",
        role: "admin",
        isActive: true,
      },
    ],
  };

  return seedData[env] || seedData.development;
};

const seedByEnvironment = async () => {
  try {
    const userData = getSeederData();
    const env = process.env.NODE_ENV || "development";

    // Ensure admin password is set in production
    if (env === "production" && !process.env.ADMIN_PASSWORD) {
      throw new Error(
        "ADMIN_PASSWORD environment variable must be set in production"
      );
    }

    console.log(`Seeding for ${env} environment...`);

    // Clear existing users in non-production environments
    if (env !== "production") {
      await User.deleteMany({});
      console.log("Cleared existing users");
    }

    const createdUsers = await User.create(userData);
    console.log(`Created ${createdUsers.length} users for ${env}`);

    return createdUsers;
  } catch (error) {
    console.error("Environment seeding failed:", error.message);
    throw error;
  }
};

module.exports = seedByEnvironment;
