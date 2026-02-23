const { z } = require("zod");

const initializePaymentSchema = z.object({
  investmentId: z.string().uuid(),
  provider: z.enum(["stripe", "paystack"]),
});

const paymentWebhookSchema = z.object({
  providerReference: z.string().trim().min(8),
  status: z.enum(["succeeded", "failed", "refunded"]),
  paidAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const paymentTransactionParamSchema = z.object({
  transactionId: z.string().uuid(),
});

module.exports = {
  initializePaymentSchema,
  paymentWebhookSchema,
  paymentTransactionParamSchema,
};
