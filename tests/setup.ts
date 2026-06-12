import { config } from "dotenv";

config({ path: ".env" });

// Integration tests need AES_MASTER_KEY + DATABASE_URL; provide safe defaults
// for unit-test-only runs so the suite works before .env exists.
if (!process.env.AES_MASTER_KEY) {
  process.env.AES_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://crazywork:crazywork@localhost:5432/crazywork";
}
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
}
if (!process.env.BETTER_AUTH_URL) {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}
