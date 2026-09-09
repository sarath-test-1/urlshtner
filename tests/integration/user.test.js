const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const mongoose = require("mongoose");

const {
  createTestUser,
  createUserWithToken,
  createAdminWithToken,
  authHeader,
} = require("../setup/testHelpers");

describe("User Endpoints", () => {
  describe("GET /api/v1/users/:id", () => {
    it("should get user details with admin token", async () => {
      const { token: adminToken } = await createAdminWithToken();
      const testUser = await createTestUser({
        name: "Test User",
        email: "testuser@example.com",
        password: "TestPass&123",
      });

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty(
        "message",
        "User details retrieved successfully"
      );

      // Check user data in response
      expect(response.body.data.id).toBe(testUser._id.toString());
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.role).toBe(testUser.role);

      // Compare dates properly (convert to ISO string or compare timestamps)
      expect(new Date(response.body.data.created_at).getTime()).toBe(
        testUser.createdAt.getTime()
      );

      expect(response.body.data.total_urls).toBe(testUser.totalUrls);
      expect(response.body.data.total_clicks).toBe(testUser.totalClicks);
      expect(response.body.data).not.toHaveProperty("password");
    });

    it("should return 403 when non-admin tries to access user details", async () => {
      const { token: userToken } = await createUserWithToken();
      const testUser = await createTestUser({
        email: "another@example.com",
        password: "TestPass&123",
      });

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .set("Authorization", authHeader(userToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain(
        "Access denied. Required role: admin"
      );
    });

    it("should return 404 for non-existent user ID", async () => {
      const { token: adminToken } = await createAdminWithToken();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set("Authorization", authHeader(adminToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("User not found");
    });

    it("should return 422 for invalid user ID format", async () => {
      const { token: adminToken } = await createAdminWithToken();

      const response = await request(app)
        .get(`/api/v1/users/invalid-id-format`)
        .set("Authorization", authHeader(adminToken))
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without authentication token", async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("should include last_login if user has logged in", async () => {
      const { token: adminToken } = await createAdminWithToken();

      // Create user and simulate login by updating lastLogin
      const testUser = await createTestUser({
        email: "loggedin@example.com",
        password: "TestPass&123",
      });
      testUser.lastLogin = new Date();
      await testUser.save();

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200);

      expect(response.body.data.last_login).not.toBe(null);
      expect(new Date(response.body.data.last_login).getTime()).toBe(
        testUser.lastLogin.getTime()
      );
    });

    it("should show correct total_urls and total_clicks", async () => {
      const { token: adminToken } = await createAdminWithToken();

      const testUser = await createTestUser({
        email: "stats@example.com",
        password: "TestPass&123",
      });

      // Update stats
      testUser.totalUrls = 5;
      testUser.totalClicks = 100;
      await testUser.save();

      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200);

      expect(response.body.data.total_urls).toBe(5);
      expect(response.body.data.total_clicks).toBe(100);
    });
  });
});

describe("DELETE /api/v1/users/:id", () => {
  it("should delete user with admin token", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser({
      name: "User To Delete",
      email: "delete@example.com",
      password: "DeletePass&123",
    });

    const response = await request(app)
      .delete(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("User deleted successfully");

    // Verify user is actually deleted from database
    const deletedUser = await User.findById(testUser._id);
    expect(deletedUser).toBeNull();
  });

  it("should return 403 when non-admin tries to delete user", async () => {
    const { token: userToken } = await createUserWithToken();
    const testUser = await createTestUser({
      email: "another@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .delete(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(userToken))
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain(
      "Access denied. Required role: admin"
    );

    // Verify user still exists
    const stillExists = await User.findById(testUser._id);
    expect(stillExists).not.toBeNull();
  });

  it("should return 404 for non-existent user ID", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/api/v1/users/${fakeId}`)
      .set("Authorization", authHeader(adminToken))
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("User not found");
  });

  it("should return 422 for invalid user ID format", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .delete(`/api/v1/users/invalid-id-format`)
      .set("Authorization", authHeader(adminToken))
      .expect(422);
    console.log(response.body);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.id[0]).toContain("Invalid user ID format");
  });

  it("should return 401 without authentication token", async () => {
    const testUser = await createTestUser();

    const response = await request(app)
      .delete(`/api/v1/users/${testUser._id}`)
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Access token is required");

    // Verify user still exists
    const stillExists = await User.findById(testUser._id);
    expect(stillExists).not.toBeNull();
  });

  it("should return 401 with invalid token", async () => {
    const testUser = await createTestUser();

    const response = await request(app)
      .delete(`/api/v1/users/${testUser._id}`)
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Invalid token");

    // Verify user still exists
    const stillExists = await User.findById(testUser._id);
    expect(stillExists).not.toBeNull();
  });

  it("should not allow admin to delete themselves", async () => {
    const { user: admin, token: adminToken } = await createAdminWithToken({
      email: "selfdelete@example.com",
    });

    const response = await request(app)
      .delete(`/api/v1/users/${admin._id}`)
      .set("Authorization", authHeader(adminToken))
      .expect(400); // Or 403, depending on your business logic

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Cannot delete your own account");

    // Verify admin still exists
    const stillExists = await User.findById(admin._id);
    expect(stillExists).not.toBeNull();
  });

  it("should delete user and their associated data", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser({
      email: "withdata@example.com",
      password: "TestPass&123",
    });

    // You might want to create some URLs or other data associated with this user
    // For now, just verify the user is deleted

    const response = await request(app)
      .delete(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify user is deleted
    const deletedUser = await User.findById(testUser._id);
    expect(deletedUser).toBeNull();

    // TODO: Verify associated URLs are also deleted when URL model is available
    // const userUrls = await Url.find({ user: testUser._id });
    // expect(userUrls).toHaveLength(0);
  });
});

describe("PATCH /api/v1/users/:id", () => {
  it("should update user with valid data as admin", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser({
      name: "Old Name",
      email: "update@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "New Name" })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("User updated successfully");
    expect(response.body.data.user.name).toBe("New Name");
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user).not.toHaveProperty("password");

    // Verify in database
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.name).toBe("New Name");
  });

  it("should return 403 when non-admin tries to update user", async () => {
    const { token: userToken } = await createUserWithToken();
    const testUser = await createTestUser({
      email: "another@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(userToken))
      .send({ name: "Hacked Name" })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain(
      "Access denied. Required role: admin"
    );

    // Verify user was not updated
    const unchangedUser = await User.findById(testUser._id);
    expect(unchangedUser.name).not.toBe("Hacked Name");
  });

  it("should return 404 for non-existent user ID", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(`/api/v1/users/${fakeId}`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "New Name" })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("User not found");
  });

  it("should return 422 for invalid user ID format", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .patch(`/api/v1/users/invalid-id`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "New Name" })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
    expect(response.body.errors.id[0]).toContain("Invalid user ID format");
  });

  it("should return 422 for invalid name (too short)", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "a" }) // Too short
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
  });

  it("should return 422 for invalid name (too long)", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "a".repeat(101) }) // Too long
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
  });

  it("should return 422 for no updates provided", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({}) // Empty update
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
  });

  it("should return 401 without authentication token", async () => {
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .send({ name: "New Name" })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Access token is required");
  });

  it("should return 401 with invalid token", async () => {
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", "Bearer invalid-token")
      .send({ name: "New Name" })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Invalid token");
  });

  it("should trim whitespace from name", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser();

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({ name: "  Trimmed Name  " })
      .expect(200);

    expect(response.body.data.user.name).toBe("Trimmed Name");

    // Verify in database
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.name).toBe("Trimmed Name");
  });

  it("should not allow updating email or role", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const testUser = await createTestUser({
      email: "original@example.com",
      role: "user",
    });

    const response = await request(app)
      .patch(`/api/v1/users/${testUser._id}`)
      .set("Authorization", authHeader(adminToken))
      .send({
        name: "New Name",
        email: "hacked@example.com", // Should be ignored
        role: "admin", // Should be ignored
      })
      .expect(200);

    expect(response.body.data.user.name).toBe("New Name");
    expect(response.body.data.user.email).toBe("original@example.com"); // Unchanged
    expect(response.body.data.user.role).toBe("user"); // Unchanged

    // Verify in database
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.email).toBe("original@example.com");
    expect(updatedUser.role).toBe("user");
  });
});

describe("GET /api/v1/users", () => {
  const names = [
    "Alice Smith",
    "Bob Johnson",
    "Charlie Brown",
    "Diana Prince",
    "Edward Norton",
    "Fiona Apple",
    "George Martin",
    "Hannah Montana",
    "Isaac Newton",
    "Julia Roberts",
    "Kevin Hart",
    "Laura Palmer",
    "Michael Scott",
    "Nancy Drew",
    "Oliver Twist",
    "Paula Abdul",
    "Quincy Jones",
    "Rachel Green",
    "Samuel Jackson",
    "Tina Fey",
    "Uma Thurman",
    "Victor Hugo",
    "Wendy Williams",
    "Xavier Woods",
    "Yolanda Adams",
    "Zachary Taylor",
  ];
  // Helper to create multiple test users
  const createMultipleUsers = async (count) => {
    const users = [];
    for (let i = 1; i <= count; i++) {
      const user = await createTestUser({
        name: names[i % names.length] || `User ${String.fromCharCode(65 + i)}`,
        email: `user${i + 1}@example.com`,
        password: "TestPass&123",
      });
      users.push(user);
    }
    return users;
  };

  it("should get all users with default pagination", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createMultipleUsers(5);

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Users retrieved successfully");
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta).toHaveProperty("current_page", 1);
    expect(response.body.meta).toHaveProperty("per_page", 10);
    expect(response.body.meta).toHaveProperty("total");
    expect(response.body.meta).toHaveProperty("last_page");

    // Check user structure
    const firstUser = response.body.data[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("name");
    expect(firstUser).toHaveProperty("email");
    expect(firstUser).toHaveProperty("role");
    expect(firstUser).toHaveProperty("created_at");
    expect(firstUser).toHaveProperty("total_urls");
    expect(firstUser).toHaveProperty("total_clicks");
    expect(firstUser).not.toHaveProperty("password");
  });

  it("should paginate users correctly", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createMultipleUsers(15);

    // Get first page
    const page1Response = await request(app)
      .get("/api/v1/users?page=1&limit=5")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(page1Response.body.data.length).toBe(5);
    expect(page1Response.body.meta.current_page).toBe(1);
    expect(page1Response.body.meta.per_page).toBe(5);

    // Get second page
    const page2Response = await request(app)
      .get("/api/v1/users?page=2&limit=5")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(page2Response.body.data.length).toBe(5);
    expect(page2Response.body.meta.current_page).toBe(2);

    // Ensure different users on different pages
    const page1Ids = page1Response.body.data.map((u) => u.id);
    const page2Ids = page2Response.body.data.map((u) => u.id);
    expect(page1Ids).not.toEqual(page2Ids);
  }, 20000);

  it("should search users by name", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({
      name: "Alice Smith",
      email: "alice@example.com",
      password: "TestPass&123",
    });
    await createTestUser({
      name: "Bob Johnson",
      email: "bob@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .get("/api/v1/users?search=Alice")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].name).toContain("Alice");
  });

  it("should search users by email", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({
      name: "Search User",
      email: "searchable@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .get("/api/v1/users?search=searchable")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    const foundUser = response.body.data.find((u) =>
      u.email.includes("searchable")
    );
    expect(foundUser).toBeDefined();
  });

  it("should be case-insensitive for search", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({
      name: "CaseSensitive User",
      email: "case@example.com",
      password: "TestPass&123",
    });

    const response = await request(app)
      .get("/api/v1/users?search=casesensitive")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    const foundUser = response.body.data.find((u) =>
      u.name.includes("CaseSensitive")
    );
    expect(foundUser).toBeDefined();
  });

  it("should sort users by name ascending", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({ name: "Zoe", email: "zoe@example.com" });
    await createTestUser({ name: "Alice", email: "alice2@example.com" });
    await createTestUser({ name: "Mike", email: "mike@example.com" });

    const response = await request(app)
      .get("/api/v1/users?sort_by=name&sort_order=asc")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    const names = response.body.data.map((u) => u.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  }, 30000);

  it("should sort users by name descending", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({ name: "Zoe", email: "zoe2@example.com" });
    await createTestUser({ name: "Alice", email: "alice3@example.com" });
    await createTestUser({ name: "Mike", email: "mike2@example.com" });

    const response = await request(app)
      .get("/api/v1/users?sort_by=name&sort_order=desc")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    const names = response.body.data.map((u) => u.name);
    const sortedNames = [...names].sort().reverse();
    expect(names).toEqual(sortedNames);
  }, 30000);

  it("should sort users by created_at descending (default)", async () => {
    const { token: adminToken } = await createAdminWithToken();

    await createTestUser({ email: "first@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createTestUser({ email: "second@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createTestUser({ email: "third@example.com" });

    const response = await request(app)
      .get("/api/v1/users?sort_by=created_at&sort_order=desc")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    // Most recent should be first
    const dates = response.body.data.map((u) =>
      new Date(u.created_at).getTime()
    );
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it("should return 403 when non-admin tries to access", async () => {
    const { token: userToken } = await createUserWithToken();

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", authHeader(userToken))
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain(
      "Access denied. Required role: admin"
    );
  });

  it("should return 422 for invalid page number", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .get("/api/v1/users?page=0")
      .set("Authorization", authHeader(adminToken))
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("The given data was invalid.");
    expect(response.body.errors.page[0]).toContain("positive integer");
  });

  it("should return 422 for invalid limit", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .get("/api/v1/users?limit=200")
      .set("Authorization", authHeader(adminToken))
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.errors.limit[0]).toContain("between 1 and 100");
  });

  it("should return 422 for invalid sort_by", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .get("/api/v1/users?sort_by=invalid_field")
      .set("Authorization", authHeader(adminToken))
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.errors.sort_by[0]).toContain("name, created_at");
  });

  it("should return 422 for invalid sort_order", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .get("/api/v1/users?sort_order=invalid")
      .set("Authorization", authHeader(adminToken))
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.errors.sort_order[0]).toContain("asc or desc");
  });

  it("should return 422 for search string too long", async () => {
    const { token: adminToken } = await createAdminWithToken();
    const longSearch = "a".repeat(101);

    const response = await request(app)
      .get(`/api/v1/users?search=${longSearch}`)
      .set("Authorization", authHeader(adminToken))
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.errors.search[0]).toContain("up to 100 characters");
  });

  it("should return 401 without authentication token", async () => {
    const response = await request(app).get("/api/v1/users").expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Access token is required");
  });

  it("should return empty array when no users match search", async () => {
    const { token: adminToken } = await createAdminWithToken();

    const response = await request(app)
      .get("/api/v1/users?search=nonexistentuser12345")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it("should calculate pagination metadata correctly", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createMultipleUsers(25);

    const response = await request(app)
      .get("/api/v1/users?page=2&limit=10")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.meta.current_page).toBe(2);
    expect(response.body.meta.per_page).toBe(10);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(25);
    expect(response.body.meta.last_page).toBeGreaterThanOrEqual(3);
    expect(response.body.meta.from).toBe(11);
    expect(response.body.meta.to).toBe(20);
  }, 50000);

  it("should handle last page with fewer items", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createMultipleUsers(7);

    const response = await request(app)
      .get("/api/v1/users?page=2&limit=5")
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.data.length).toBeLessThanOrEqual(5);
    expect(response.body.meta.current_page).toBe(2);
  }, 50000);

  it("should combine search, sort, and pagination", async () => {
    const { token: adminToken } = await createAdminWithToken();
    await createTestUser({ name: "Apple User", email: "apple1@example.com" });
    await createTestUser({ name: "Apple Admin", email: "apple2@example.com" });
    await createTestUser({ name: "Banana User", email: "banana@example.com" });

    const response = await request(app)
      .get(
        "/api/v1/users?search=Apple&sort_by=name&sort_order=asc&page=1&limit=5"
      )
      .set("Authorization", authHeader(adminToken))
      .expect(200);

    expect(response.body.success).toBe(true);
    response.body.data.forEach((user) => {
      expect(user.name.toLowerCase()).toContain("apple");
    });
  }, 50000);
});
