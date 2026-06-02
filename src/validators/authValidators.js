import { z } from "zod";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "name must be at least 2 characters")
    .max(100, "name must be at most 100 characters"),
  email: z.string().trim().toLowerCase().email("invalid email format"),
  password: z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(128, "password must be at most 128 characters"),
  location: z
    .string()
    .trim()
    .min(2, "location is required")
    .max(200, "location must be at most 200 characters"),
  role: z.enum(["user", "provider"]).optional().default("user"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("invalid email format"),
  password: z.string().min(1, "password is required"),
});

export { registerSchema, loginSchema };
