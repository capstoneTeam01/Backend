import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import redisClient from "./src/config/redis.js";

import {
  authRoutes,
  userRoutes,
  photoRoutes,
  providerRoutes,
  analysisRoutes,
  notificationRoutes,
  businessDirectoryProviderRoutes,
} from "./src/routes/index.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const services = {};

// MongoDB connection
try {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("MongoDB connected successfully");
} catch (error) {
  console.log("MongoDB connection failed:", error.message);
}

// Redis connection
try {
  services.redis = await redisClient(process.env.REDIS_URL);
  console.log("Redis connected successfully");
} catch (error) {
  console.log("Redis connection failed:", error.message);
}

// Test route
app.get("/health", async (req, res) => {
  try {
    let redisStatus = "Redis not connected";

    if (services.redis) {
      await services.redis.set("test_key", "Redis working");
      const value = await services.redis.get("test_key");

      if (value === "Redis working") {
        redisStatus = "Redis connected";
      }
    }

    res.json({
      server: "Running",
      mongo:
        mongoose.connection.readyState === 1
          ? "MongoDB connected"
          : "MongoDB not connected",
      redis: redisStatus,
    });
  } catch (error) {
    res.status(500).json({
      server: "Running",
      error: error.message,
    });
  }
});

app.use("/api/auth", authRoutes(services));
app.use("/api/users", userRoutes(services));
app.use("/api/photos", photoRoutes(services));
app.use("/api/analysis", analysisRoutes(services));
app.use("/api/business-directory/providers", businessDirectoryProviderRoutes(services));
app.use("/api/notifications", notificationRoutes(services));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
