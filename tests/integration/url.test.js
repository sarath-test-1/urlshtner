const request = require("supertest");
const app = require("../../app");
const Url = require("../../models/Url");

const {
  createUserWithToken,
  createAdminWithToken,
  authHeader,
} = require("../setup/testHelpers");

const {
  createTestUrl,
  createMultipleTestUrls,
  testUrlData,
  validateUrlResponse,
  validatePaginationResponse,
} = require("../setup/urlHelpers");

describe("URL Endpoints", () => {
  let user, userToken, admin, adminToken;

  beforeEach(async () => {
    // Create test user and admin for each test
    const userData = await createUserWithToken();
    user = userData.user;
    userToken = userData.token;

    const adminData = await createAdminWithToken();
    admin = adminData.user;
    adminToken = adminData.token;
  });

  describe("POST /api/v1/urls", () => {
    it("should create a short URL with valid data", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.valid)
        .expect(201);

      // Check response structure
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Short URL created successfully");
      expect(response.body.data).toBeDefined();

      // Validate URL response structure
      const urlData = response.body.data;
      validateUrlResponse(urlData);

      // Check specific values
      expect(urlData.longUrl).toBe(testUrlData.valid.longUrl);
      expect(urlData.clickCount).toBe(0);
      expect(urlData.isActive).toBe(true);
      expect(urlData.shortCode).toBeDefined();
      expect(urlData.shortUrl).toContain(urlData.shortCode);

      // Verify URL was created in database
      const dbUrl = await Url.findById(urlData.id);
      expect(dbUrl).toBeTruthy();
      expect(dbUrl.longUrl).toBe(testUrlData.valid.longUrl);
      expect(dbUrl.userId.toString()).toBe(user._id.toString());
    });

    it("should create a short URL without expiry date", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.validWithoutExpiry)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expiresAt).toBeNull();
    });

    it("should return 400 for invalid URL", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.invalidUrl)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("validation");
    });

    it("should return 400 for empty URL", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.emptyUrl)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for missing longUrl", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .send(testUrlData.valid)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", "Bearer invalid-token")
        .send(testUrlData.valid)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should accept HTTP URLs", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.httpUrl)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.longUrl).toBe(testUrlData.httpUrl.longUrl);
    });

    it("should handle URLs with query parameters", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .send(testUrlData.longUrlWithParams)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.longUrl).toBe(
        testUrlData.longUrlWithParams.longUrl
      );
    });
  });

  describe("GET /api/v1/urls", () => {
    beforeEach(async () => {
      // Create multiple URLs for the user
      await createMultipleTestUrls(user._id, 5);
      // Create URLs for another user to test isolation
      const anotherUser = await createUserWithToken();
      await createMultipleTestUrls(anotherUser.user._id, 3);
    });

    it("should get user URLs with default pagination", async () => {
      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(userToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URLs retrieved successfully");
      expect(response.body.data).toHaveProperty("urls");
      expect(response.body.data).toHaveProperty("pagination");

      const { urls, pagination } = response.body.data;

      // Check URLs array
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBe(5); // Only user's URLs

      // Validate first URL structure
      if (urls.length > 0) {
        validateUrlResponse(urls[0]);
      }

      // Validate pagination
      validatePaginationResponse(pagination, 5);
      expect(pagination.currentPage).toBe(1);
      expect(pagination.limit).toBe(10);
      expect(pagination.totalPages).toBe(1);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });

    it("should support pagination with custom page and limit", async () => {
      // Create more URLs to test pagination
      await createMultipleTestUrls(user._id, 10);

      const response = await request(app)
        .get("/api/v1/urls?page=2&limit=5")
        .set("Authorization", authHeader(userToken))
        .expect(200);

      const { urls, pagination } = response.body.data;

      expect(urls.length).toBe(5);
      validatePaginationResponse(pagination, 15); // 5 + 10 = 15 total
      expect(pagination.currentPage).toBe(2);
      expect(pagination.limit).toBe(5);
      expect(pagination.totalPages).toBe(3);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    it("should support search functionality", async () => {
      // Create a URL with specific content for searching
      await createTestUrl(user._id, {
        longUrl: "https://searchable-example.com",
        title: "Searchable Title",
      });

      const response = await request(app)
        .get("/api/v1/urls?search=searchable")
        .set("Authorization", authHeader(userToken))
        .expect(200);

      const { urls } = response.body.data;
      expect(urls.length).toBeGreaterThan(0);

      // Check that returned URLs contain search term
      const searchableUrl = urls.find((url) =>
        url.longUrl.includes("searchable")
      );
      expect(searchableUrl).toBeDefined();
    });

    it("should support sorting by click count", async () => {
      const response = await request(app)
        .get("/api/v1/urls?sortBy=clickCount&sortOrder=desc")
        .set("Authorization", authHeader(userToken))
        .expect(200);

      const { urls } = response.body.data;

      if (urls.length > 1) {
        // Check that URLs are sorted by clickCount in descending order
        for (let i = 0; i < urls.length - 1; i++) {
          expect(urls[i].clickCount).toBeGreaterThanOrEqual(
            urls[i + 1].clickCount
          );
        }
      }
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/v1/urls").expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return empty array for user with no URLs", async () => {
      const newUser = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(newUser.token))
        .expect(200);

      const { urls, pagination } = response.body.data;
      expect(urls).toEqual([]);
      expect(pagination.totalUrls).toBe(0);
    });

    it("should validate pagination parameters", async () => {
      const response = await request(app)
        .get("/api/v1/urls?page=-1&limit=1000")
        .set("Authorization", authHeader(userToken))
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/urls/:id", () => {
    let testUrl;

    beforeEach(async () => {
      testUrl = await createTestUrl(user._id);
    });

    it("should get URL details for owned URL", async () => {
      const response = await request(app)
        .get(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URL details retrieved successfully");

      const urlData = response.body.data;
      validateUrlResponse(urlData);
      expect(urlData.id).toBe(testUrl._id.toString());
      expect(urlData.longUrl).toBe(testUrl.longUrl);
    });

    it("should allow admin to get any URL details", async () => {
      const response = await request(app)
        .get(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUrl._id.toString());
    });

    it("should return 404 for non-existent URL", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011"; // Valid ObjectId but doesn't exist

      const response = await request(app)
        .get(`/api/v1/urls/${nonExistentId}`)
        .set("Authorization", authHeader(userToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });

    it("should return 400 for invalid URL ID format", async () => {
      const response = await request(app)
        .get("/api/v1/urls/invalid-id")
        .set("Authorization", authHeader(userToken))
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .get(`/api/v1/urls/${testUrl._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should prevent access to other users URLs", async () => {
      // Create URL for another user
      const anotherUser = await createUserWithToken();
      const anotherUserUrl = await createTestUrl(anotherUser.user._id);

      const response = await request(app)
        .get(`/api/v1/urls/${anotherUserUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .expect(404); // Should return 404, not 403, for security

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/urls/:id", () => {
    let testUrl;

    beforeEach(async () => {
      testUrl = await createTestUrl(user._id);
    });

    it("should update URL successfully", async () => {
      const updateData = {
        longUrl: "https://updated-example.com",
        isActive: false,
      };

      const response = await request(app)
        .put(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URL updated successfully");

      const urlData = response.body.data;
      expect(urlData.longUrl).toBe(updateData.longUrl);
      expect(urlData.isActive).toBe(updateData.isActive);

      // Verify in database
      const updatedUrl = await Url.findById(testUrl._id);
      expect(updatedUrl.longUrl).toBe(updateData.longUrl);
      expect(updatedUrl.isActive).toBe(updateData.isActive);
    });

    it("should allow admin to update any URL", async () => {
      const updateData = {
        longUrl: "https://admin-updated-example.com",
      };

      const response = await request(app)
        .put(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(adminToken))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.longUrl).toBe(updateData.longUrl);
    });

    it("should return 404 for non-existent URL", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .put(`/api/v1/urls/${nonExistentId}`)
        .set("Authorization", authHeader(userToken))
        .send({ longUrl: "https://example.com" })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should return 403 when trying to update other users URL", async () => {
      const anotherUser = await createUserWithToken();
      const anotherUserUrl = await createTestUrl(anotherUser.user._id);

      const response = await request(app)
        .put(`/api/v1/urls/${anotherUserUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .send({ longUrl: "https://hacker.com" })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should validate update data", async () => {
      const response = await request(app)
        .put(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .send({ longUrl: "invalid-url" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .put(`/api/v1/urls/${testUrl._id}`)
        .send({ longUrl: "https://example.com" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/urls/:id", () => {
    let testUrl;

    beforeEach(async () => {
      testUrl = await createTestUrl(user._id);
    });

    it("should delete URL successfully", async () => {
      const response = await request(app)
        .delete(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted successfully");

      // Verify URL is deleted from database
      const deletedUrl = await Url.findById(testUrl._id);
      expect(deletedUrl).toBeNull();
    });

    it("should allow admin to delete any URL", async () => {
      const response = await request(app)
        .delete(`/api/v1/urls/${testUrl._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedUrl = await Url.findById(testUrl._id);
      expect(deletedUrl).toBeNull();
    });

    it("should return 404 for non-existent URL", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .delete(`/api/v1/urls/${nonExistentId}`)
        .set("Authorization", authHeader(userToken))
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should return 403 when trying to delete other users URL", async () => {
      const anotherUser = await createUserWithToken();
      const anotherUserUrl = await createTestUrl(anotherUser.user._id);

      const response = await request(app)
        .delete(`/api/v1/urls/${anotherUserUrl._id}`)
        .set("Authorization", authHeader(userToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Verify URL still exists
      const stillExists = await Url.findById(anotherUserUrl._id);
      expect(stillExists).toBeTruthy();
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .delete(`/api/v1/urls/${testUrl._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);

      // Verify URL still exists
      const stillExists = await Url.findById(testUrl._id);
      expect(stillExists).toBeTruthy();
    });

    it("should return 400 for invalid URL ID format", async () => {
      const response = await request(app)
        .delete("/api/v1/urls/invalid-id")
        .set("Authorization", authHeader(userToken))
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
