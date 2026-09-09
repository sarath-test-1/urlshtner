const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const User = require("../../models/User");
const {
  createTestUser,
  createUserWithToken,
  testUserData,
  authHeader,
} = require("../setup/testHelpers");

describe("Auth Endpoints", () => {
  describe("POST /api/v1/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const userData = testUserData.valid;

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      // Check response structure
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "User registered successfully"
      );
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty(
        "access_token",
        expect.any(String)
      );
      expect(response.body.data).toHaveProperty("token_type", "Bearer");

      // Check user data in response
      const { user } = response.body.data;
      expect(user).toHaveProperty("id");
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe("user");
      expect(user).not.toHaveProperty("password");

      // Check refresh token cookie is set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain("HttpOnly");

      // Verify user was created in database
      const dbUser = await User.findById(user.id);
      expect(dbUser).toBeTruthy();
      expect(dbUser.name).toBe(userData.name);
      expect(dbUser.email).toBe(userData.email);

      // Verify token is valid
      const accessToken = response.body.data.access_token;
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user.id);
    });

    it("should return 422 for invalid email format", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(testUserData.invalidEmail)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 for weak password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(testUserData.weakPassword)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 for invalid username", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(testUserData.invalidUsername)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 for username with special characters", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(testUserData.specialCharsUsername)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 for duplicate email", async () => {
      // Create user first
      await createTestUser({ email: "duplicate@example.com" });

      // Try to register with same email
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "newuser",
          email: "duplicate@example.com",
          password: "ValidPass123",
        })
        .expect(422);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should not allow non-admin to register as admin", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "wannabeadmin",
          email: "admin@example.com",
          password: "AdminPass&123",
          role: "admin",
        })
        .expect(201);

      // Should create user but with 'user' role, not 'admin'
      expect(response.body.data.user.role).toBe("user");
    });

    it("should return 422 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "testuser",
          // missing email and password
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await createTestUser({
        name: "test user",
        email: "login@example.com",
        password: "LoginPass&123",
      });
    });

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@example.com",
          password: "LoginPass&123",
        })
        .expect(200);

      console.log(response.body);

      // Check response structure
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("access_token");
      expect(response.body.data).toHaveProperty("token_type", "Bearer");

      // Check refresh token cookie is set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain("HttpOnly");

      // Check user data
      const { user } = response.body.data;
      expect(user.email).toBe("login@example.com");
      expect(user).toHaveProperty("last_login");
      expect(user).not.toHaveProperty("password");

      // Verify token is valid
      const accessToken = response.body.data.access_token;
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user.id);
    });

    it("should return 401 for invalid email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "LoginPass&123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid credentials");
    });

    it("should return 401 for invalid password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@example.com",
          password: "WrongPassword",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid credentials");
    });

    it("should return 401 for inactive user", async () => {
      // Create inactive user
      await createTestUser({
        name: "inactive user",
        email: "inactive@example.com",
        password: "InactivePass&123",
        isActive: false,
      });

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "inactive@example.com",
          password: "InactivePass&123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid credentials");
    });

    it("should return 422 for invalid email format", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "invalid-email-format",
          password: "LoginPass&123",
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 for missing password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@example.com",
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should update lastLogin timestamp on successful login", async () => {
      const userBefore = await User.findOne({ email: "login@example.com" });
      const initialLastLogin = userBefore.lastLogin;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@example.com",
          password: "LoginPass&123",
        })
        .expect(200);

      const userAfter = await User.findOne({ email: "login@example.com" });
      expect(userAfter.lastLogin).not.toEqual(initialLastLogin);
      expect(userAfter.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout successfully with valid token", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Logged out successfully");

      // Verify refresh token cookie is cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(refreshTokenCookie).toBeDefined();
      // Cookie should be expired (Max-Age=0 or expired date)
      expect(refreshTokenCookie).toMatch(/Max-Age=0|expires=/i);
    });

    it("should return 401 without authorization header", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("should return 401 with expired token", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: "someUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" } // Expired 1 hour ago
      );

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", authHeader(expiredToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Token expired");
    });

    it("should return 401 for token with non-existent user", async () => {
      // Create token for non-existent user
      const nonExistentToken = jwt.sign(
        { userId: "507f1f77bcf86cd799439011" }, // Valid ObjectId but user doesn't exist
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", authHeader(nonExistentToken))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid or expired token");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should refresh access token with valid refresh token", async () => {
      const { user } = await createUserWithToken();

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "30d" }
      );

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Token refreshed successfully");
      expect(response.body.data).toHaveProperty("access_token");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("token_type", "Bearer");

      // Verify new token is valid
      const newToken = response.body.data.access_token;
      const decoded = jwt.verify(newToken, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user._id.toString());
    });

    it("should return 401 without refresh token cookie", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=invalid-token`])
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 with expired refresh token", async () => {
      const { user } = await createUserWithToken();

      const expiredToken = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "-1h" }
      );

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredToken}`])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("expired");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should get current user with valid token", async () => {
      const { user, token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User retrieved successfully");
      expect(response.body.data.user).toHaveProperty("id");
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user).not.toHaveProperty("password");
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/auth/me").expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/auth/profile", () => {
    it("should update user profile with valid data", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", authHeader(token))
        .send({ name: "Updated Name" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Profile updated successfully");
      expect(response.body.data.user.name).toBe("Updated Name");
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .put("/api/v1/auth/profile")
        .send({ name: "Updated Name" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 422 for invalid name", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", authHeader(token))
        .send({ name: "a" }) // Too short
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it("should return 422 for no updates provided", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", authHeader(token))
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });
  });

  describe("PATCH /api/v1/auth/change-password", () => {
    it("should change password with valid credentials", async () => {
      const { user, token } = await createUserWithToken({
        password: "OldPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", authHeader(token))
        .send({
          current_password: "OldPass&123",
          new_password: "NewPass&456",
          password_confirmation: "NewPass&456",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Password changed successfully");

      // Verify refresh token cookie is cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(refreshTokenCookie).toBeDefined();

      // Verify new password works
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: user.email,
          password: "NewPass&456",
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it("should return 422 when password confirmation doesn't match", async () => {
      const { token } = await createUserWithToken({
        password: "OldPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", authHeader(token))
        .send({
          current_password: "OldPass&123",
          new_password: "NewPass&456",
          password_confirmation: "DifferentPass&789",
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 when password confirmation is missing", async () => {
      const { token } = await createUserWithToken({
        password: "OldPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", authHeader(token))
        .send({
          current_password: "OldPass&123",
          new_password: "NewPass&456",
          // missing password_confirmation
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 400 for incorrect current password", async () => {
      const { token } = await createUserWithToken({
        password: "OldPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", authHeader(token))
        .send({
          current_password: "WrongPass&123",
          new_password: "NewPass&456",
          password_confirmation: "NewPass&456",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid credentials");
    });

    it("should return 400 when new password is same as current", async () => {
      const { token } = await createUserWithToken({
        password: "SamePass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", authHeader(token))
        .send({
          current_password: "SamePass&123",
          new_password: "SamePass&123",
          password_confirmation: "SamePass&123",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("must be different");
    });

    it("should return 422 for weak new password", async () => {
      const { token } = await createUserWithToken({
        password: "OldPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          current_password: "OldPass&123",
          new_password: "weak",
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .patch("/api/v1/auth/change-password")
        .send({
          current_password: "OldPass&123",
          new_password: "NewPass&456",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/auth/deactivate", () => {
    it("should deactivate account with valid password", async () => {
      const user = await createTestUser({
        name: "test user",
        email: "deactivate@example.com",
        password: "DeactivatePass&123",
      });

      // Login to get refresh token cookie
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "deactivate@example.com",
          password: "DeactivatePass&123",
        })
        .expect(200);

      const token = loginResponse.body.data.access_token;
      const cookies = loginResponse.headers["set-cookie"];

      const response = await request(app)
        .patch("/api/v1/auth/deactivate")
        .set("Authorization", authHeader(token))
        .set("Cookie", cookies) // Pass cookies from login
        .send({ password: "DeactivatePass&123" })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify refresh token cookie is cleared
      const responseCookies = response.headers["set-cookie"];
      expect(responseCookies).toBeDefined();
      const refreshTokenCookie = responseCookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toMatch(/Max-Age=0|expires=/i);

      // Verify user is deactivated in database
      const dbUser = await User.findById(user._id);
      expect(dbUser.isActive).toBe(false);
    });

    it("should return 400 for incorrect password", async () => {
      const { token } = await createUserWithToken({
        password: "CorrectPass&123",
      });

      const response = await request(app)
        .patch("/api/v1/auth/deactivate")
        .set("Authorization", authHeader(token))
        .send({ password: "WrongPass&123" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid password");
    });

    it("should return 422 for missing password", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .patch("/api/v1/auth/deactivate")
        .set("Authorization", authHeader(token))
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .patch("/api/v1/auth/deactivate")
        .send({ password: "SomePass&123" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
