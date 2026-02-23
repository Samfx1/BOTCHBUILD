const { z } = require("zod");

const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(20).max(4000),
  location: z.string().trim().min(2).max(255),
  totalBudget: z.coerce.number().positive().max(1_000_000_000),
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date string.")
    .optional(),
  status: z.enum(["planned", "in_progress", "completed", "paused"]).default("planned"),
});

const listProjectsQuerySchema = z.object({
  status: z.enum(["planned", "in_progress", "completed", "paused"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const projectIdParamSchema = z.object({
  projectId: z.string().uuid(),
});

const createProjectUpdateSchema = z.object({
  mediaType: z.enum(["photo", "video"]),
  mediaUrl: z.string().url(),
  caption: z.string().trim().max(600).optional(),
  capturedAt: z.string().datetime().optional(),
});

module.exports = {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  createProjectUpdateSchema,
};
