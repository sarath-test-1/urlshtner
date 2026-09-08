const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    // serverSelectionTimeoutMS is the big one for your checklist item — without it, Mongoose defaults
    // to 30s before giving up, which is a long hang for a health check or startup script to sit through.
    
    // socketTimeoutMS protects against a connection that goes silent mid-query (network partition, etc.) rather
    // than closing cleanly.

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // fail fast if no server reachable in 5s
      connectTimeoutMS: 10000,        // max time to establish initial connection
      socketTimeoutMS: 45000,         // max time a socket can be idle before closing
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);

    process.exit(1);
  }
};

module.exports = connectDB;
