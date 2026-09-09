const request = require("supertest");
const app = require("../../app");
// const Click = require("../../models/Click");
const Url = require("../../models/Url");
const User = require("../../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const {
  createUserWithToken,
  createAdminWithToken,
  authHeader,
} = require("../setup/testHelpers");

const {
  createTestUrl,
  createMultipleTestUrls,
} = require("../setup/urlHelpers");

describe("URL Endpoints", () => {
  describe("GET /api/v1/urls", () => {
    it("should get all user's URLs with default pagination", async () => {
      const { user, token } = await createUserWithToken();
      await createMultipleTestUrls(user._id, 5);

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URLs retrieved successfully");
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check pagination metadata
      expect(response.body.meta).toHaveProperty("current_page", 1);
      expect(response.body.meta).toHaveProperty("per_page", 10);
      expect(response.body.meta).toHaveProperty("total");
      expect(response.body.meta).toHaveProperty("last_page");

      // Check URL structure
      const firstUrl = response.body.data[0];
      expect(firstUrl).toHaveProperty("id");
      expect(firstUrl).toHaveProperty("shortCode");
      expect(firstUrl).toHaveProperty("shortUrl");
      expect(firstUrl).toHaveProperty("longUrl");
      expect(firstUrl).toHaveProperty("title");
      expect(firstUrl).toHaveProperty("description");
      expect(firstUrl).toHaveProperty("clickCount");
      expect(firstUrl).toHaveProperty("isActive");
      expect(firstUrl).toHaveProperty("expiresAt");
      expect(firstUrl).toHaveProperty("lastAccessedAt");
      expect(firstUrl).toHaveProperty("createdAt");
    });

    it("should only return URLs belonging to the authenticated user", async () => {
      const { user: user1, token: token1 } = await createUserWithToken();
      const { user: user2 } = await createUserWithToken({
        email: "user2@example.com",
      });

      await createTestUrl(user1._id, { shortCode: "user1url" });
      await createTestUrl(user2._id, { shortCode: "user2url" });

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token1))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].shortCode).toBe("user1url");
    });

    it("should paginate URLs correctly", async () => {
      const { user, token } = await createUserWithToken();
      await createMultipleTestUrls(user._id, 15);

      // Get first page
      const page1Response = await request(app)
        .get("/api/v1/urls?page=1&limit=5")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(page1Response.body.data.length).toBe(5);
      expect(page1Response.body.meta.current_page).toBe(1);
      expect(page1Response.body.meta.per_page).toBe(5);

      // Get second page
      const page2Response = await request(app)
        .get("/api/v1/urls?page=2&limit=5")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(page2Response.body.data.length).toBe(5);
      expect(page2Response.body.meta.current_page).toBe(2);

      // Ensure different URLs on different pages
      const page1Ids = page1Response.body.data.map((u) => u.id);
      const page2Ids = page2Response.body.data.map((u) => u.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it("should search URLs by long URL", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, {
        shortCode: "search1",
        longUrl: "https://example.com/findme",
      });
      await createTestUrl(user._id, {
        shortCode: "search2",
        longUrl: "https://different.com/other",
      });

      const response = await request(app)
        .get("/api/v1/urls?search=findme")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].longUrl).toContain("findme");
    });

    it("should search URLs by title", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, {
        shortCode: "titled1",
        title: "Special Title",
      });
      await createTestUrl(user._id, {
        shortCode: "titled2",
        title: "Other Title",
      });

      const response = await request(app)
        .get("/api/v1/urls?search=Special")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      const foundUrl = response.body.data.find((u) =>
        u.title.includes("Special")
      );
      expect(foundUrl).toBeDefined();
    });

    it("should search URLs by short code", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, { shortCode: "abc123" });
      await createTestUrl(user._id, { shortCode: "xyz789" });

      const response = await request(app)
        .get("/api/v1/urls?search=abc")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].shortCode).toContain("abc");
    });

    it("should be case-insensitive for search", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, {
        shortCode: "case1",
        title: "CaseSensitive Title",
      });

      const response = await request(app)
        .get("/api/v1/urls?search=casesensitive")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      const foundUrl = response.body.data.find((u) =>
        u.title.includes("CaseSensitive")
      );
      expect(foundUrl).toBeDefined();
    });

    it("should sort URLs by created_at descending (default)", async () => {
      const { user, token } = await createUserWithToken();

      await createTestUrl(user._id, { shortCode: "first" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestUrl(user._id, { shortCode: "second" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestUrl(user._id, { shortCode: "third" });

      const response = await request(app)
        .get("/api/v1/urls?sort_by=created_at&sort_order=desc")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      const dates = response.body.data.map((u) =>
        new Date(u.createdAt).getTime()
      );
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it("should sort URLs by created_at ascending", async () => {
      const { user, token } = await createUserWithToken();
      await createMultipleTestUrls(user._id, 3);

      const response = await request(app)
        .get("/api/v1/urls?sort_by=created_at&sort_order=asc")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      const dates = response.body.data.map((u) =>
        new Date(u.createdAt).getTime()
      );
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it("should sort URLs by click_count descending", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, { shortCode: "low", clickCount: 5 });
      await createTestUrl(user._id, { shortCode: "high", clickCount: 100 });
      await createTestUrl(user._id, { shortCode: "med", clickCount: 50 });

      const response = await request(app)
        .get("/api/v1/urls?sort_by=click_count&sort_order=desc")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      const clicks = response.body.data.map((u) => u.clickCount);
      for (let i = 0; i < clicks.length - 1; i++) {
        expect(clicks[i]).toBeGreaterThanOrEqual(clicks[i + 1]);
      }
    });

    it("should return 422 for invalid page number", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls?page=0")
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.page[0]).toContain("positive integer");
    });

    it("should return 422 for invalid limit", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls?limit=200")
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.limit[0]).toContain("between 1 and 100");
    });

    it("should return 422 for invalid sort_by", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls?sort_by=invalid_field")
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.sort_by[0]).toContain(
        "click_count, expires_at, created_at"
      );
    });

    it("should return 422 for invalid sort_order", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls?sort_order=invalid")
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.sort_order[0]).toContain("asc or desc");
    });

    it("should return 422 for search string too long", async () => {
      const { token } = await createUserWithToken();
      const longSearch = "a".repeat(101);

      const response = await request(app)
        .get(`/api/v1/urls?search=${longSearch}`)
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.search[0]).toContain("up to 100 characters");
    });

    it("should return 401 without authentication token", async () => {
      const response = await request(app).get("/api/v1/urls").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return empty array when user has no URLs", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it("should return empty array when no URLs match search", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, { shortCode: "findme" });

      const response = await request(app)
        .get("/api/v1/urls?search=nonexistent12345")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it("should calculate pagination metadata correctly", async () => {
      const { user, token } = await createUserWithToken();
      await createMultipleTestUrls(user._id, 25);

      const response = await request(app)
        .get("/api/v1/urls?page=2&limit=10")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.meta.current_page).toBe(2);
      expect(response.body.meta.per_page).toBe(10);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(25);
      expect(response.body.meta.last_page).toBeGreaterThanOrEqual(3);
      expect(response.body.meta.from).toBe(11);
      expect(response.body.meta.to).toBe(20);
    });

    it("should handle last page with fewer items", async () => {
      const { user, token } = await createUserWithToken();
      await createMultipleTestUrls(user._id, 7);

      const response = await request(app)
        .get("/api/v1/urls?page=2&limit=5")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.meta.current_page).toBe(2);
    });

    it("should combine search, sort, and pagination", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, {
        shortCode: "apple1",
        title: "Apple URL",
        clickCount: 10,
      });
      await createTestUrl(user._id, {
        shortCode: "apple2",
        title: "Apple Test",
        clickCount: 20,
      });
      await createTestUrl(user._id, {
        shortCode: "banana1",
        title: "Banana URL",
        clickCount: 5,
      });

      const response = await request(app)
        .get(
          "/api/v1/urls?search=Apple&sort_by=click_count&sort_order=desc&page=1&limit=5"
        )
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((url) => {
        expect(url.title.toLowerCase()).toContain("apple");
      });
      // Check descending click count order
      const clicks = response.body.data.map((u) => u.clickCount);
      for (let i = 0; i < clicks.length - 1; i++) {
        expect(clicks[i]).toBeGreaterThanOrEqual(clicks[i + 1]);
      }
    });

    it("should format short URL correctly", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, { shortCode: "test123" });

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data[0].shortUrl).toBe(
        `${process.env.BASE_URL}/test123`
      );
    });

    it("should include inactive URLs in results", async () => {
      const { user, token } = await createUserWithToken();
      await createTestUrl(user._id, { shortCode: "active", isActive: true });
      await createTestUrl(user._id, { shortCode: "inactive", isActive: false });

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.length).toBe(2);
      const inactiveUrl = response.body.data.find(
        (u) => u.shortCode === "inactive"
      );
      expect(inactiveUrl).toBeDefined();
      expect(inactiveUrl.isActive).toBe(false);
    });

    it("should include expired URLs in results", async () => {
      const { user, token } = await createUserWithToken();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createTestUrl(user._id, {
        shortCode: "expired",
        expiresAt: pastDate,
      });

      const response = await request(app)
        .get("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      const expiredUrl = response.body.data.find(
        (u) => u.shortCode === "expired"
      );
      expect(expiredUrl).toBeDefined();
    });
  });

  describe("GET /api/v1/urls/:id", () => {
    it("should get URL details for owner", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "myurl123",
        longUrl: "https://example.com/test",
        title: "My Test URL",
        description: "Test description",
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URL details retrieved successfully");
      expect(response.body.data).toHaveProperty("id", url._id.toString());
      expect(response.body.data).toHaveProperty("short_code", "myurl123");
      expect(response.body.data).toHaveProperty(
        "short_url",
        `${process.env.BASE_URL}/myurl123`
      );
      expect(response.body.data).toHaveProperty(
        "long_url",
        "https://example.com/test"
      );
      expect(response.body.data).toHaveProperty("title", "My Test URL");
      expect(response.body.data).toHaveProperty(
        "description",
        "Test description"
      );
      expect(response.body.data).toHaveProperty("click_count", 0);
      expect(response.body.data).toHaveProperty("is_active", true);
      expect(response.body.data).toHaveProperty("expires_at");
      expect(response.body.data).toHaveProperty("last_accessed_at");
      expect(response.body.data).toHaveProperty("created_at");
      expect(response.body.data).toHaveProperty("updated_at");
    });

    it("should return 403 when user tries to access another user's URL", async () => {
      const { user: user1 } = await createUserWithToken();
      const { token: user2Token } = await createUserWithToken(
        {
          email: "user2@example.com",
        },
        50000
      );

      const url = await createTestUrl(user1._id, {
        shortCode: "user1url",
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(user2Token))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should return 404 for non-existent URL ID", async () => {
      const { token } = await createUserWithToken();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/urls/${fakeId}`)
        .set("Authorization", authHeader(token))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Resource not found");
    });

    it("should return 422 for invalid URL ID format", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .get(`/api/v1/urls/invalid-id`)
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.id[0]).toContain("Invalid Url ID format");
    });

    it("should return 401 without authentication token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("should show correct click_count", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "clicked",
        clickCount: 42,
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.click_count).toBe(42);
    });

    it("should show inactive URLs", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(
        user._id,
        {
          shortCode: "inactive",
          isActive: false,
        },
        50000
      );

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active).toBe(false);
    });

    it("should show expired URLs", async () => {
      const { user, token } = await createUserWithToken();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const url = await createTestUrl(user._id, {
        shortCode: "expired",
        expiresAt: pastDate,
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expires_at).toBeDefined();
      expect(new Date(response.body.data.expires_at).getTime()).toBe(
        pastDate.getTime()
      );
    });

    it("should show last_accessed_at when URL has been accessed", async () => {
      const { user, token } = await createUserWithToken();
      const accessDate = new Date();

      const url = await createTestUrl(user._id, {
        shortCode: "accessed",
        lastAccessedAt: accessDate,
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.last_accessed_at).toBeDefined();
      expect(new Date(response.body.data.last_accessed_at).getTime()).toBe(
        accessDate.getTime()
      );
    });

    it("should handle URL with no title or description", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "notitle",
        title: "",
        description: "",
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("");
      expect(response.body.data.description).toBe("");
    });

    it("should format short_url correctly with BASE_URL", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "abc123",
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.short_url).toBe(
        `${process.env.BASE_URL}/abc123`
      );
    });

    it("should show created_at and updated_at timestamps", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.created_at).toBeDefined();
      expect(response.body.data.updated_at).toBeDefined();
      expect(new Date(response.body.data.created_at).getTime()).toBe(
        url.createdAt.getTime()
      );
      expect(new Date(response.body.data.updated_at).getTime()).toBe(
        url.updatedAt.getTime()
      );
    });

    it("admin cannot access other user's URL without ownership", async () => {
      const { user } = await createUserWithToken();
      const { token: adminToken } = await createAdminWithToken();

      const url = await createTestUrl(user._id, {
        shortCode: "userurl",
      });

      const response = await request(app)
        .get(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });
  });

  describe("DELETE /api/v1/urls/:id", () => {
    it("should delete URL with valid ownership", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "deleteme",
        longUrl: "https://example.com/delete",
      });

      const response = await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      expect(response.body).toEqual({});

      // Verify URL is deleted from database
      const deletedUrl = await Url.findById(url._id);
      expect(deletedUrl).toBeNull();
    });

    it("should return 403 when user tries to delete another user's URL", async () => {
      const { user: user1 } = await createUserWithToken();
      const { token: user2Token } = await createUserWithToken({
        email: "user2@example.com",
      });

      const url = await createTestUrl(user1._id, {
        shortCode: "notmine",
      });

      const response = await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(user2Token))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Verify URL still exists
      const stillExists = await Url.findById(url._id);
      expect(stillExists).not.toBeNull();
    });

    it("should return 404 for non-existent URL ID", async () => {
      const { token } = await createUserWithToken();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/v1/urls/${fakeId}`)
        .set("Authorization", authHeader(token))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Resource not found");
    });

    it("should return 422 for invalid URL ID format", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .delete(`/api/v1/urls/invalid-id`)
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.id[0]).toContain("Invalid Url ID format");
    });

    it("should return 401 without authentication token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");

      // Verify URL still exists
      const stillExists = await Url.findById(url._id);
      expect(stillExists).not.toBeNull();
    });

    it("should return 401 with invalid token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");

      // Verify URL still exists
      const stillExists = await Url.findById(url._id);
      expect(stillExists).not.toBeNull();
    });

    it("should delete URL with clicks", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "withclicks",
        clickCount: 10,
      });

      // Create some clicks
      //   await Click.create({
      //     urlId: url._id,
      //     shortCode: url.shortCode,
      //     timestamp: new Date(),
      //     ipAddress: "127.0.0.1",
      //     userAgent: "Mozilla",
      //   });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify URL is deleted
      const deletedUrl = await Url.findById(url._id);
      expect(deletedUrl).toBeNull();

      // TODO: Verify clicks are also deleted when Click model is available
      // const remainingClicks = await Click.find({ urlId: url._id });
      // expect(remainingClicks).toHaveLength(0);
    });

    it.skip("should update user totalUrls count after deletion", async () => {
      const { user, token } = await createUserWithToken();

      // Get initial user stats
      const userBefore = await User.findById(user._id);
      const initialTotalUrls = userBefore.totalUrls;

      const url = await createTestUrl(user._id, {
        shortCode: "updatestats",
      });

      // Update user totalUrls to reflect the created URL
      await User.findByIdAndUpdate(user._id, {
        $inc: { totalUrls: 1 },
      });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify user stats updated
      const userAfter = await User.findById(user._id);
      expect(userAfter.totalUrls).toBe(initialTotalUrls); // Back to original
    });

    it.skip("should update user totalClicks count after deletion", async () => {
      const { user, token } = await createUserWithToken();

      const url = await createTestUrl(user._id, {
        shortCode: "clickstats",
        clickCount: 50,
      });

      // Set initial user clicks
      await User.findByIdAndUpdate(user._id, {
        $set: { totalClicks: 100 },
      });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify user stats updated (100 - 50 = 50)
      const userAfter = await User.findById(user._id);
      expect(userAfter.totalClicks).toBe(50);
    });

    it("should delete inactive URLs", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "inactive",
        isActive: false,
      });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify URL is deleted
      const deletedUrl = await Url.findById(url._id);
      expect(deletedUrl).toBeNull();
    });

    it("should delete expired URLs", async () => {
      const { user, token } = await createUserWithToken();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const url = await createTestUrl(user._id, {
        shortCode: "expired",
        expiresAt: pastDate,
      });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify URL is deleted
      const deletedUrl = await Url.findById(url._id);
      expect(deletedUrl).toBeNull();
    });

    it("admin cannot delete other user's URL without ownership", async () => {
      const { user } = await createUserWithToken();
      const { token: adminToken } = await createAdminWithToken();

      const url = await createTestUrl(user._id, {
        shortCode: "admintest",
      });

      const response = await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(adminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Verify URL still exists
      const stillExists = await Url.findById(url._id);
      expect(stillExists).not.toBeNull();
    });

    it("should handle deletion of URL with zero clicks", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "zeroclicks",
        clickCount: 0,
      });

      await request(app)
        .delete(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .expect(204);

      // Verify URL is deleted
      const deletedUrl = await Url.findById(url._id);
      expect(deletedUrl).toBeNull();
    });
  });

  describe("PATCH /api/v1/urls/:id/toggle", () => {
    it("should toggle URL from active to inactive", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "active",
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URL status updated successfully");
      expect(response.body.data).toHaveProperty("id", url._id.toString());
      expect(response.body.data).toHaveProperty("short_code", "active");
      expect(response.body.data).toHaveProperty("is_active", false);
      expect(response.body.data).toHaveProperty("message", "URL deactivated");

      // Verify in database
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.isActive).toBe(false);
    });

    it("should toggle URL from inactive to active", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "inactive",
        isActive: false,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active).toBe(true);
      expect(response.body.data.message).toBe("URL activated");

      // Verify in database
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.isActive).toBe(true);
    });

    it("should toggle multiple times correctly", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "toggle",
        isActive: true,
      });

      // First toggle: active -> inactive
      const response1 = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response1.body.data.is_active).toBe(false);
      expect(response1.body.data.message).toBe("URL deactivated");

      // Second toggle: inactive -> active
      const response2 = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response2.body.data.is_active).toBe(true);
      expect(response2.body.data.message).toBe("URL activated");

      // Third toggle: active -> inactive
      const response3 = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response3.body.data.is_active).toBe(false);
      expect(response3.body.data.message).toBe("URL deactivated");
    });

    it("should return 403 when user tries to toggle another user's URL", async () => {
      const { user: user1 } = await createUserWithToken();
      const { token: user2Token } = await createUserWithToken({
        email: "user2@example.com",
      });

      const url = await createTestUrl(user1._id, {
        shortCode: "notmine",
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(user2Token))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Verify URL status unchanged
      const unchangedUrl = await Url.findById(url._id);
      expect(unchangedUrl.isActive).toBe(true);
    });

    it("should return 404 for non-existent URL ID", async () => {
      const { token } = await createUserWithToken();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/v1/urls/${fakeId}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Resource not found");
    });

    it("should return 422 for invalid URL ID format", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .patch(`/api/v1/urls/invalid-id/toggle`)
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.id[0]).toContain("Invalid Url ID format");
    });

    it("should return 401 without authentication token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");

      // Verify URL status unchanged
      const unchangedUrl = await Url.findById(url._id);
      expect(unchangedUrl.isActive).toBe(true);
    });

    it("should return 401 with invalid token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");

      // Verify URL status unchanged
      const unchangedUrl = await Url.findById(url._id);
      expect(unchangedUrl.isActive).toBe(true);
    });

    it("should toggle expired URL status", async () => {
      const { user, token } = await createUserWithToken();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const url = await createTestUrl(user._id, {
        shortCode: "expired",
        isActive: true,
        expiresAt: pastDate,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      expect(response.body.data.is_active).toBe(false);

      // Verify in database
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.isActive).toBe(false);
      expect(updatedUrl.expiresAt.getTime()).toBe(pastDate.getTime());
    });

    it("should not affect other URL properties when toggling", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "preserve",
        longUrl: "https://example.com/original",
        title: "Original Title",
        description: "Original Description",
        clickCount: 42,
        isActive: true,
      });

      await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      // Verify other properties unchanged
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.isActive).toBe(false); // Only this changed
      expect(updatedUrl.shortCode).toBe("preserve");
      expect(updatedUrl.longUrl).toBe("https://example.com/original");
      expect(updatedUrl.title).toBe("Original Title");
      expect(updatedUrl.description).toBe("Original Description");
      expect(updatedUrl.clickCount).toBe(42);
    });

    it("admin cannot toggle other user's URL without ownership", async () => {
      const { user } = await createUserWithToken();
      const { token: adminToken } = await createAdminWithToken();

      const url = await createTestUrl(user._id, {
        shortCode: "admintest",
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(adminToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Verify URL status unchanged
      const unchangedUrl = await Url.findById(url._id);
      expect(unchangedUrl.isActive).toBe(true);
    });

    it("should update updatedAt timestamp when toggling", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "timestamp",
        isActive: true,
      });

      const originalUpdatedAt = url.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .expect(200);

      // Verify updatedAt changed
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it("should handle body data gracefully (toggle ignores request body)", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, {
        shortCode: "ignorebody",
        isActive: true,
      });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}/toggle`)
        .set("Authorization", authHeader(token))
        .send({ is_active: true, title: "Hacked" }) // These should be ignored
        .expect(200);

      expect(response.body.data.is_active).toBe(false); // Toggled, not set to true

      // Verify title unchanged
      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.title).toBe(url.title); // Original title
    });
  });

  describe("PATCH /api/v1/urls/:id (Update URL)", () => {
    it("should update URL fields successfully (partial update)", async () => {
      const { user, token } = await createUserWithToken();

      const url = await createTestUrl(user._id, {
        shortCode: "update123",
        longUrl: "https://example.com/old",
        title: "Old title",
        description: "Old description",
        isActive: true,
      });

      const payload = {
        long_url: "https://example.com/new",
        title: "New title",
      };

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("URL updated successfully");
      expect(response.body.data.id).toBe(url._id.toString());
      expect(response.body.data.long_url).toBe(payload.long_url);
      expect(response.body.data.title).toBe(payload.title);
      expect(response.body.data.description).toBe("Old description"); // unchanged
    });

    it("should update expires_at", async () => {
      const { user, token } = await createUserWithToken();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ expires_at: futureDate })
        .expect(200);

      expect(new Date(response.body.data.expires_at).getTime()).toBe(
        futureDate.getTime()
      );
    });

    it("should update is_active flag", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id, { isActive: true });

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ is_active: false })
        .expect(200);

      expect(response.body.data.is_active).toBe(false);

      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.isActive).toBe(false);
    });

    it("should return 403 when updating another user's URL", async () => {
      const { user: owner } = await createUserWithToken();
      const { token } = await createUserWithToken({
        email: "other@example.com",
      });

      const url = await createTestUrl(owner._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ title: "Hacked" })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should return 404 for non-existent URL", async () => {
      const { token } = await createUserWithToken();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/v1/urls/${fakeId}`)
        .set("Authorization", authHeader(token))
        .send({ title: "Test" })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Resource not found");
    });

    it("should return 422 for invalid URL ID format", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .patch("/api/v1/urls/invalid-id")
        .set("Authorization", authHeader(token))
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.id[0]).toContain("Invalid Url ID format");
    });

    it("should return 422 when no valid fields are provided", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ foo: "bar" })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
      expect(response.body.errors.msg[0]).toContain(
        "At least one valid field must be provided for update"
      );
    });

    it("should return 422 for invalid long_url", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ long_url: "not-a-url" })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.long_url[0]).toContain("valid URL");
    });

    it("should return 422 for past expires_at", async () => {
      const { user, token } = await createUserWithToken();
      const pastDate = new Date(Date.now() - 1000);

      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ expires_at: pastDate })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.expires_at[0]).toContain(
        "Expiration date must be in the future"
      );
    });

    it("should return 401 without authentication", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .send({ title: "Test" })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const { user } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", "Bearer invalid-token")
        .send({ title: "Test" })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("admin cannot update other user's URL", async () => {
      const { user } = await createUserWithToken();
      const { token: adminToken } = await createAdminWithToken();

      const url = await createTestUrl(user._id);

      const response = await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(adminToken))
        .send({ title: "Admin update" })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should update updated_at timestamp", async () => {
      const { user, token } = await createUserWithToken();
      const url = await createTestUrl(user._id);

      const originalUpdatedAt = url.updatedAt;
      await new Promise((r) => setTimeout(r, 10));

      await request(app)
        .patch(`/api/v1/urls/${url._id}`)
        .set("Authorization", authHeader(token))
        .send({ title: "Timestamp test" })
        .expect(200);

      const updatedUrl = await Url.findById(url._id);
      expect(updatedUrl.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe("DELETE /api/v1/urls/bulk-delete", () => {
    it("should bulk delete URLs for the owner", async () => {
      const { user, token } = await createUserWithToken();

      const urls = await createMultipleTestUrls(user._id, 3);

      const urlIds = urls.map((u) => u._id.toString());

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({ url_ids: urlIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(3);

      // Verify all URLs deleted
      const remaining = await Url.find({ _id: { $in: urlIds } });
      expect(remaining).toHaveLength(0);
    });

    it("should return 422 when url_ids is missing", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 when url_ids is empty array", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({ url_ids: [] })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("The given data was invalid.");
    });

    it("should return 422 when url_ids contains invalid ObjectId", async () => {
      const { token } = await createUserWithToken();

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({ url_ids: ["invalid-id"] })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.url_ids[0]).toContain(
        "valid MongoDB ObjectIds"
      );
    });

    it("should return 404 when one or more URLs do not exist", async () => {
      const { user, token } = await createUserWithToken();

      const url = await createTestUrl(user._id);
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({ url_ids: [url._id.toString(), fakeId.toString()] })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");

      // Existing URL should remain
      const stillExists = await Url.findById(url._id);
      expect(stillExists).not.toBeNull();
    });

    it("should return 403 if any URL is not owned by the user", async () => {
      const { user: owner } = await createUserWithToken();
      const { token } = await createUserWithToken({
        email: "other@example.com",
      });

      const ownedUrl = await createTestUrl(owner._id);
      const foreignUrl = await createTestUrl(owner._id);

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(token))
        .send({
          url_ids: [ownedUrl._id.toString(), foreignUrl._id.toString()],
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      // Nothing deleted
      const urls = await Url.find({
        _id: { $in: [ownedUrl._id, foreignUrl._id] },
      });
      expect(urls).toHaveLength(2);
    });

    it("should return 401 without authentication token", async () => {
      const { user } = await createUserWithToken();
      const urls = await createMultipleTestUrls(user._id, 2);

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .send({ url_ids: urls.map((u) => u._id.toString()) })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access token is required");
    });

    it("should return 401 with invalid token", async () => {
      const { user } = await createUserWithToken();
      const urls = await createMultipleTestUrls(user._id, 2);

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", "Bearer invalid-token")
        .send({ url_ids: urls.map((u) => u._id.toString()) })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("admin cannot bulk delete other user's URLs", async () => {
      const { user } = await createUserWithToken();
      const { token: adminToken } = await createAdminWithToken();

      const urls = await createMultipleTestUrls(user._id, 2);

      const response = await request(app)
        .delete("/api/v1/urls/bulk-delete")
        .set("Authorization", authHeader(adminToken))
        .send({ url_ids: urls.map((u) => u._id.toString()) })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");

      const stillExists = await Url.find({
        _id: { $in: urls.map((u) => u._id) },
      });
      expect(stillExists).toHaveLength(2);
    });
  });

  describe("POST /api/v1/urls", () => {
    it("should create a short URL as a guest (no auth)", async () => {
      const payload = {
        long_url: "https://example.com/public",
        title: "Public URL",
        description: "Created without auth",
      };

      const response = await request(app)
        .post("/api/v1/urls")
        .send(payload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Short URL created successfully");

      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.user_id).toBeNull();
      expect(response.body.data.long_url).toBe(payload.long_url);
      expect(response.body.data.title).toBe(payload.title);
      expect(response.body.data.description).toBe(payload.description);
      expect(response.body.data.short_code).toBeDefined();
      expect(response.body.data.short_url).toContain(
        response.body.data.short_code
      );

      const urlInDb = await Url.findById(response.body.data.id);
      expect(urlInDb).not.toBeNull();
      expect(urlInDb.userId).toBeNull();
    });

    it("should create a short URL for authenticated user", async () => {
      const { user, token } = await createUserWithToken();

      const payload = {
        long_url: "https://example.com/private",
        title: "Private URL",
      };

      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(token))
        .send(payload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(user._id.toString());

      const urlInDb = await Url.findById(response.body.data.id);
      expect(urlInDb.userId.toString()).toBe(user._id.toString());
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", "Bearer invalid-token")
        .send({ long_url: "https://example.com" })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("should return 401 for expired token", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: "someUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" } // Expired 1 hour ago
      );

      const response = await request(app)
        .post("/api/v1/urls")
        .set("Authorization", authHeader(expiredToken))
        .send({ long_url: "https://example.com" })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Token expired");
    });

    it("should return 422 when long_url is missing", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .send({ title: "Missing URL" })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.long_url[0]).toContain("URL is required");
    });

    it("should return 422 for invalid URL", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .send({ long_url: "not-a-url" })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.long_url[0]).toContain("valid URL");
    });

    it("should return 422 for past expires_at", async () => {
      const pastDate = new Date(Date.now() - 1000);

      const response = await request(app)
        .post("/api/v1/urls")
        .send({
          long_url: "https://example.com",
          expires_at: pastDate,
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.expires_at[0]).toContain(
        "Expiration date must be in the future"
      );
    });

    it("should allow expires_at in the future", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post("/api/v1/urls")
        .send({
          long_url: "https://example.com",
          expires_at: futureDate,
        })
        .expect(201);

      expect(new Date(response.body.data.expires_at).getTime()).toBe(
        futureDate.getTime()
      );
    });

    it("should trim title and description", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .send({
          long_url: "https://example.com",
          title: "   Trimmed Title   ",
          description: "   Trimmed Desc   ",
        })
        .expect(201);

      expect(response.body.data.title).toBe("Trimmed Title");
      expect(response.body.data.description).toBe("Trimmed Desc");
    });

    it("should default title and description to empty strings", async () => {
      const response = await request(app)
        .post("/api/v1/urls")
        .send({ long_url: "https://example.com" })
        .expect(201);

      expect(response.body.data.title).toBe("");
      expect(response.body.data.description).toBe("");
    });
  });
});
