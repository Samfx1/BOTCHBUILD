const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

function isPlaceholderSecret(value) {
  if (!value) {
    return true;
  }
  const lowered = String(value).toLowerCase();
  return (
    lowered.includes("change-me") ||
    lowered.includes("dev-") ||
    lowered.includes("local-dev") ||
    lowered.includes("example")
  );
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://botchbuild:botchbuild@localhost:5432/botchbuild"),
  BACKEND_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),
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
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  PAYSTACK_SECRET_KEY: z.string().default("paystack_dev_secret"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(8).default("local-dev-webhook-secret"),
  MEDIA_STORAGE_PROVIDER: z
    .enum(["local", "s3", "cloudinary"])
    .default("local"),
  AWS_REGION: z.string().default("eu-west-1"),
  AWS_S3_BUCKET: z.string().default(""),
  AWS_S3_PUBLIC_BASE_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z
    .string()
    .default("noreply@botchbuild.local"),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_SMS_FROM: z.string().default(""),
  TWILIO_WHATSAPP_FROM: z.string().default(""),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(10).default(500),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(5).default(40),
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().min(10).default(200),
  RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().int().min(20).default(600),
  RATE_LIMIT_OPS_MAX: z.coerce.number().int().min(5).default(60),
  OPS_DEAD_JOB_THRESHOLD: z.coerce.number().int().min(0).default(100),
  OPS_WORKER_POLL_MS: z.coerce.number().int().min(500).default(5000),
  OPS_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const config = parsed.data;
config.CORS_ALLOWED_ORIGINS_LIST = config.CORS_ALLOWED_ORIGINS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (config.CORS_ALLOWED_ORIGINS_LIST.length === 0) {
  config.CORS_ALLOWED_ORIGINS_LIST = [config.FRONTEND_URL];
}

if (config.NODE_ENV === "production") {
  const errors = [];

  if (isPlaceholderSecret(config.JWT_ACCESS_SECRET)) {
    errors.push("JWT_ACCESS_SECRET must be set to a non-placeholder value.");
  }
  if (isPlaceholderSecret(config.JWT_2FA_SECRET)) {
    errors.push("JWT_2FA_SECRET must be set to a non-placeholder value.");
  }
  if (isPlaceholderSecret(config.PAYMENT_WEBHOOK_SECRET)) {
    errors.push("PAYMENT_WEBHOOK_SECRET must be set to a non-placeholder value.");
  }

  const hasStripe = /^sk_(test|live)_/.test(config.STRIPE_SECRET_KEY);
  const hasPaystack =
    Boolean(config.PAYSTACK_SECRET_KEY) &&
    !config.PAYSTACK_SECRET_KEY.includes("dev_secret");
  if (!hasStripe && !hasPaystack) {
    errors.push(
      "At least one payment provider key must be configured (Stripe or Paystack).",
    );
  }
  if (hasStripe && !config.STRIPE_WEBHOOK_SECRET) {
    errors.push("STRIPE_WEBHOOK_SECRET must be set when Stripe is enabled.");
  }

  if (!config.BACKEND_PUBLIC_URL.startsWith("https://")) {
    errors.push("BACKEND_PUBLIC_URL must use https in production.");
  }
  if (!config.FRONTEND_URL.startsWith("https://")) {
    errors.push("FRONTEND_URL must use https in production.");
  }

  if (errors.length > 0) {
    throw new Error(`Production environment validation failed: ${errors.join(" ")}`);
  }
}

module.exports = config;
