import { config } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV === "test") {
  config({
    path: ".env.test",
  });
} else {
  config();
}

const environmentVariablesSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_CLIENT: z.enum(["sqlite", "pg"]),
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3333),
});

const _env = environmentVariablesSchema.safeParse(process.env);

if (!_env.success) {
  console.error("🚨 Invalid or missing environment variables.");
  throw new Error("Invalid or missing environment variables.");
}

export const env = _env.data;
