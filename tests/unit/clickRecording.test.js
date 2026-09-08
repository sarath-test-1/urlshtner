const Click = require("../../models/Click");
const Url = require("../../models/Url");
const User = require("../../models/User");
const { recordClick } = require("../../services/urlService");

const {
  createTestUser,
  createUserWithToken,
  createAdminWithToken,
  authHeader,
} = require("../setup/testHelpers");
const {
  createTestUrl,
  createMultipleTestUrls,
} = require("../setup/urlHelpers");

describe("Click Recording", () => {
  let user, url;

  beforeEach(async () => {
    const { user: testUser } = await createUserWithToken();
    user = testUser;

    url = await createTestUrl(user._id, {
      shortCode: "clicktest",
      clickCount: 0,
    });
  });

  it("should increment URL click count", async () => {
    const clientInfo = {
      ipAddress: "127.0.0.1",
      userAgent: "Test Browser",
      referrer: "https://example.com",
    };

    await recordClick(url.shortCode, url, clientInfo);

    const updatedUrl = await Url.findById(url._id);
    expect(updatedUrl.clickCount).toBe(1);
  });

  it("should update user total clicks", async () => {
    const initialClicks = user.totalClicks || 0;

    const clientInfo = {
      ipAddress: "127.0.0.1",
      userAgent: "Test Browser",
    };

    await recordClick(url.shortCode, url, clientInfo);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.totalClicks).toBe(initialClicks + 1);
  });

  it("should create click analytics record", async () => {
    const clientInfo = {
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      referrer: "https://google.com",
      country: "US",
      city: "New York",
    };

    await recordClick(url.shortCode, url, clientInfo);

    const click = await Click.findOne({ urlId: url._id });
    expect(click).toBeDefined();
    expect(click.ipAddress).toBe("192.168.1.1");
    expect(click.userAgent).toBe("Mozilla/5.0");
    expect(click.referrer).toBe("https://google.com");
  });

  it("should update lastAccessedAt timestamp", async () => {
    const clientInfo = { userAgent: "Mozilla/5.0", ipAddress: "127.0.0.1" };

    await recordClick(url.shortCode, url, clientInfo);

    const updatedUrl = await Url.findById(url._id);
    expect(updatedUrl.lastAccessedAt).toBeDefined();
    expect(updatedUrl.lastAccessedAt).toBeInstanceOf(Date);
  });
});
