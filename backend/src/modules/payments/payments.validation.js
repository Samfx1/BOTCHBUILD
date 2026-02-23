const { z } = require("zod");

const initializePaymentSchema = z.object({
  investmentId: z.string().uuid(),
  provider: z.enum(["stripe", "paystack"]),
});

const paymentTransactionParamSchema = z.object({
  transactionId: z.string().uuid(),
});

module.exports = {
  initializePaymentSchema,
  paymentTransactionParamSchema,
};
