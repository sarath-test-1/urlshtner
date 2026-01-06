const User = require("../models/User");

const adminUsers = [
  {
    name: process.env.ADMIN_NAME || "admin",
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
    isActive: true,
  },
  {
    name: process.env.ADMIN2_NAME || "admin2",
    email: process.env.ADMIN2_EMAIL || "admin2@example.com",
    password: process.env.ADMIN2_PASSWORD,
    role: "admin",
    isActive: true,
  },
];

const seedUsers = async () => {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN2_PASSWORD) {
    throw new Error("Admin seed passwords are not defined");
  }

  console.log("Starting user seeding...");

  if (process.env.NODE_ENV !== "production") {
    await User.deleteMany({ role: "admin" });
    console.log("Cleared existing admin users");
  }

  const createdUsers = await User.create(adminUsers);
  console.log(`Successfully created ${createdUsers.length} admin users`);
};

module.exports = seedUsers;
