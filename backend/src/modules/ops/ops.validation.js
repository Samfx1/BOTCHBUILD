const { z } = require("zod");

const listJobsQuerySchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed", "dead"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const processJobsBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

const listAuditQuerySchema = z.object({
  level: z.enum(["info", "warn", "error"]).optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const enqueueReconcileSchema = z.object({
  olderThanMinutes: z.coerce.number().int().min(5).max(60 * 24).default(60),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

module.exports = {
  listJobsQuerySchema,
  processJobsBodySchema,
  listAuditQuerySchema,
  enqueueReconcileSchema,
};
