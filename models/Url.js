const mongoose = require("mongoose");
const validator = require("validator");

if (!process.env.BASE_URL) {
  console.warn(
    "WARNING: BASE_URL environment variable is not set. shortUrl virtual will return null."
  );
}

const urlSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    shortCode: {
      type: String,
      required: [true, "Short code is required"],
      unique: true,
      trim: true,
      minlength: [1, "Short code must be at least 1 character long"],
      maxlength: [20, "Short code cannot exceed 20 characters"],
      match: [
        /^[a-zA-Z0-9]+$/,
        "Short code can only contain letters and numbers",
      ],
    },
    longUrl: {
      type: String,
      required: [true, "Long URL is required"],
      trim: true,
      maxlength: [2048, "URL cannot exceed 2048 characters"],
      validate: {
        validator: function (v) {
          return validator.isURL(v, {
            require_protocol: true,
            protocols: ["http", "https"],
            require_tld: true,
            allow_underscores: false,
          });
        },
        message: "Please provide a valid URL with http or https protocol",
      },
    },
    clickCount: {
      type: Number,
      default: 0,
      min: [0, "Click count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          // Only validate if expiresAt is being modified
          if (!this.isModified("expiresAt")) return true;
          return !v || v > new Date();
        },
        message: "Expiration date must be in the future",
      },
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create indexes for performance
urlSchema.index({ userId: 1 });
urlSchema.index({ userId: 1, createdAt: -1 });
urlSchema.index({ isActive: 1 });
urlSchema.index({ expiresAt: 1 });
urlSchema.index({ clickCount: -1 });

urlSchema.index(
  { longUrl: "text", title: "text" },
  { weights: { title: 10, longUrl: 5 } }
); // Text search index with title prioritized

// Check if URL is expired
urlSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt;
};

urlSchema.methods.incrementClick = async function () {
  const updated = await this.constructor.findByIdAndUpdate(
    this._id,
    {
      $inc: { clickCount: 1 },
      $set: { lastAccessedAt: new Date() },
    },
    { new: true }
  );
  if (!updated) {
    throw new Error("URL document not found during click increment");
  }
  this.clickCount = updated.clickCount;
  this.lastAccessedAt = updated.lastAccessedAt;
  return this;
};

// Virtual for formatted creation date
urlSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toISOString().split("T")[0];
});

// Virtual for days since creation
urlSchema.virtual("daysSinceCreated").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for short URL
urlSchema.virtual("shortUrl").get(function () {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}/${this.shortCode}`;
});

// Pre-save middleware to handle expiration
urlSchema.pre("save", function (next) {
  if (this.isExpired()) {
    this.isActive = false;
  }
  next();
});

// Static method to find active URLs
urlSchema.statics.findActive = function () {
  return this.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
};

// Static method to find expired URLs
urlSchema.statics.findExpired = function () {
  return this.find({
    expiresAt: { $lte: new Date() },
  });
};

module.exports = mongoose.model("Url", urlSchema);
