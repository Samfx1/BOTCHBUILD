const { z } = require("zod");

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/;

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  role: z.enum(["investor", "developer"]).default("investor"),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(
      strongPasswordRegex,
      "Password must include uppercase, lowercase, number, and symbol.",
    ),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const verifyTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, "Token must be 6 digits."),
});

const verifyLogin2FASchema = z.object({
  tempToken: z.string().min(10),
  token: z.string().regex(/^\d{6}$/, "Token must be 6 digits."),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyTokenSchema,
  verifyLogin2FASchema,
};
