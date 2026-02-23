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
  BACKEND_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

module.exports = parsed.data;
