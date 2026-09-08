const net = require("net");

const mongoose = require("mongoose");

const clickSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: [true, "URL ID is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    shortCode: {
      type: String,
      required: [true, "Short code is required"],
      trim: true,
    },
    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
      validate: {
        validator: function (v) {
          return net.isIP(v) !== 0;
        },
        message: "Invalid IP address format",
      },
    },
    userAgent: {
      type: String,
      required: true,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },
    referrer: {
      type: String,
      default: "",
      maxlength: [500, "Referrer cannot exceed 500 characters"],
    },
    country: {
      type: String,
      default: "Unknown",
      maxlength: [100, "Country name cannot exceed 100 characters"],
    },
    city: {
      type: String,
      default: "Unknown",
      maxlength: [100, "City name cannot exceed 100 characters"],
    },
    browser: {
      type: String,
      default: "Unknown",
      maxlength: [50, "Browser name cannot exceed 50 characters"],
    },
    os: {
      type: String,
      default: "Unknown",
      maxlength: [50, "OS name cannot exceed 50 characters"],
    },
    device: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "unknown",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false, // We're using custom timestamp field
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Create indexes for analytics queries
clickSchema.index({ urlId: 1, timestamp: -1 });
clickSchema.index({ userId: 1, timestamp: -1 });
clickSchema.index({ shortCode: 1, timestamp: -1 });
clickSchema.index({ timestamp: -1 });

// Virtual for formatted timestamp
clickSchema.virtual("formattedTimestamp").get(function () {
  return this.timestamp.toISOString();
});

// Virtual for date only
clickSchema.virtual("dateOnly").get(function () {
  return this.timestamp.toISOString().split("T")[0];
});

module.exports = mongoose.model("Click", clickSchema);
