const { faker } = require("@faker-js/faker");
const User = require("../models/User");

const createFakeUsers = async (count = 10) => {
  const users = [];

  if (!process.env.ADMIN_SEED_PASSWORD) {
    throw new Error("ADMIN_SEED_PASSWORD is not defined");
  }

  // Generate fake users
  for (let i = 0; i < count; i++) {
    const name = faker.internet
      .userName()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_]/g, "_");

    users.push({
      name: name.substring(0, 20), // Ensure within limits
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 8 }),
      role: faker.helpers.weightedArrayElement([
        { weight: 9, value: "user" },
        { weight: 1, value: "admin" },
      ]),
      isActive: faker.datatype.boolean(0.9), // 90% active users
      totalUrls: faker.number.int({ min: 0, max: 50 }),
      totalClicks: faker.number.int({ min: 0, max: 1000 }),
    });
  }

  try {
    const createdUsers = await User.insertMany(users);
    console.log(`Created ${createdUsers.length} users (including admins)`);
    return createdUsers;
  } catch (error) {
    console.error("Error creating fake users:", error.message);
    throw error;
  }
};

module.exports = createFakeUsers;
