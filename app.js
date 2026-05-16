import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import redisClient from "./config/redis.js";

import {
  authRoutes,
  userRoutes,
  photoRoutes,
  providerRoutes,
} from "./routes/index.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const services = {};

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("mongodb connected");
  })
  .catch((error) => {
    console.log(error);
  });

services.redis = await redisClient(process.env.REDIS_URL);

app.use("/api/auth", authRoutes(services));
app.use("/api/users", userRoutes(services));
app.use("/api/photos", photoRoutes(services));
app.use("/api/providers", providerRoutes(services));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});