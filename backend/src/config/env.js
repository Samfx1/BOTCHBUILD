const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://botchbuild:botchbuild@localhost:5432/botchbuild"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default("dev-access-secret-value-should-be-overridden"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_2FA_SECRET: z
    .string()
    .min(32)
    .default("dev-2fa-secret-value-should-be-overridden"),
  JWT_2FA_EXPIRES_IN: z.string().default("5m"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(8).default("local-dev-webhook-secret"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

module.exports = parsed.data;
