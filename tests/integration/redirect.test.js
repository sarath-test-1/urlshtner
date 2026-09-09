const request = require("supertest");
const app = require("../../app");
const Url = require("../../models/Url");
const UrlService = require("../../services/v1/urlService");
const { createUserWithToken } = require("../setup/testHelpers");
const { createTestUrl } = require("../setup/urlHelpers");

describe("URL Redirect Endpoint", () => {
  let user, testUrl;

  beforeEach(async () => {
    // Create test user and URL for each test
    const userData = await createUserWithToken();
    user = userData.user;

    testUrl = await createTestUrl(user._id, {
      longUrl: "https://www.google.com",
      shortCode: "testcode123",
      isActive: true,
    });
  });

  describe("GET /:shortCode (Redirect)", () => {
    it("should redirect to long URL for valid short code", async () => {
      const response = await request(app)
        .get(`/${testUrl.shortCode}`)
        .expect(302);

      // Check redirect location
      expect(response.headers.location).toBe(testUrl.longUrl);

      // remove
      //   //   Verify click count was incremented (need slight delay)
      //   setTimeout(async () => {
      //     const updatedUrl = await Url.findById(testUrl._id);
      //     expect(updatedUrl.clickCount).toBe(testUrl.clickCount + 1);
      //   }, 200);
    });

    it("should handle case sensitivity of short codes", async () => {
      // Test with uppercase version of shortCode
      const response = await request(app)
        .get(`/${testUrl.shortCode.toUpperCase()}`)
        .expect(404); // Assuming short codes are case sensitive

      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("Link Not Found");
    });

    it("should return 404 HTML page for non-existent short code", async () => {
      const response = await request(app).get("/nonexistent123").expect(404);

      // Check that response is HTML
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("Link Not Found");
      expect(response.text).toContain("doesn't exist or has expired");
    });

    it("should return 404 for inactive URL", async () => {
      // Update URL to be inactive
      await Url.findByIdAndUpdate(testUrl._id, { isActive: false });

      const response = await request(app)
        .get(`/${testUrl.shortCode}`)
        .expect(404);

      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("Link Not Found");
    });

    it("should return 404 for expired URL", async () => {
      // Update URL to be expired
      await Url.findByIdAndUpdate(testUrl._id, {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      const response = await request(app)
        .get(`/${testUrl.shortCode}`)
        .expect(404);

      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("Link Not Found");
    });

    it("should handle different URL schemes (HTTP)", async () => {
      const httpUrl = await createTestUrl(user._id, {
        longUrl: "http://example.com",
        shortCode: "httptest123",
        isActive: true,
      });

      const response = await request(app)
        .get(`/${httpUrl.shortCode}`)
        .expect(302);

      expect(response.headers.location).toBe("http://example.com");
    });

    it("should handle URLs with query parameters", async () => {
      const paramUrl = await createTestUrl(user._id, {
        longUrl: "https://example.com/page?param1=value1&param2=value2",
        shortCode: "paramtest123",
        isActive: true,
      });

      const response = await request(app)
        .get(`/${paramUrl.shortCode}`)
        .expect(302);

      expect(response.headers.location).toBe(
        "https://example.com/page?param1=value1&param2=value2"
      );
    });

    it("should handle URLs with fragments", async () => {
      const fragmentUrl = await createTestUrl(user._id, {
        longUrl: "https://example.com/page#section1",
        shortCode: "fragtest123",
        isActive: true,
      });

      const response = await request(app)
        .get(`/${fragmentUrl.shortCode}`)
        .expect(302);

      expect(response.headers.location).toBe(
        "https://example.com/page#section1"
      );
    });

    // it("should update lastAccessedAt timestamp", async () => {
    //   const initialAccessTime = testUrl.lastAccessedAt;

    //   await request(app).get(`/${testUrl.shortCode}`).expect(302);

    //   //   // Wait a bit and check that lastAccessedAt was updated
    //     setTimeout(async () => {
    //       const updatedUrl = await Url.findById(testUrl._id);
    //       if (initialAccessTime) {
    //         expect(updatedUrl.lastAccessedAt).not.toEqual(initialAccessTime);
    //       } else {
    //         expect(updatedUrl.lastAccessedAt).toBeDefined();
    //       }
    //     }, 100);
    // });

    it("should return 500 HTML page on server error", async () => {
      jest
        .spyOn(UrlService, "getLongUrl")
        .mockRejectedValueOnce(new Error("Database error"));
      const response = await request(app).get("/errortest123").expect(500);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("Server Error");

      // Restore mock
      UrlService.getLongUrl.mockRestore();
    });

    // it("should handle concurrent clicks properly", async () => {
    //     const initialClickCount = testUrl.clickCount;

    //   // Make multiple concurrent requests
    //   const promises = Array(5)
    //     .fill()
    //     .map(() => request(app).get(`/${testUrl.shortCode}`).expect(302));

    //   await Promise.all(promises);

    //   // Wait a bit for analytics to be recorded
    //   setTimeout(async () => {
    //     const updatedUrl = await Url.findById(testUrl._id);
    //     expect(updatedUrl.clickCount).toBeGreaterThan(initialClickCount);
    //   }, 500);
    // });

    it("should not redirect if shortCode is empty", async () => {
      const response = await request(app).get("/").expect(404);
    });

    it("should return 422 for invalid short code format", async () => {
      const response = await request(app).get("/invalid@code!").expect(422);

      expect(response.body.success).toBe(false);
    });
  });
});
