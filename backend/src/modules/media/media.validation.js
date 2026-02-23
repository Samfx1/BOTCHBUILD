const { z } = require("zod");

const mediaTypeSchema = z.enum(["photo", "video"]);

const createUploadTargetSchema = z.object({
  mediaType: mediaTypeSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(3).max(120),
  projectId: z.string().uuid().optional(),
});

module.exports = {
  mediaTypeSchema,
  createUploadTargetSchema,
};
