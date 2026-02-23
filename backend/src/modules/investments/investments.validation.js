const { z } = require("zod");

const createInvestmentSchema = z.object({
  projectId: z.string().uuid(),
  amount: z.coerce.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("USD"),
});

const listMyInvestmentsQuerySchema = z.object({
  status: z.enum(["pending", "active", "cancelled", "withdrawn"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = {
  createInvestmentSchema,
  listMyInvestmentsQuerySchema,
};
