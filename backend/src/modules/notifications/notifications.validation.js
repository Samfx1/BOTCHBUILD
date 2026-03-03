const { z } = require("zod");

const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
});

const createTestNotificationSchema = z.object({
  channel: z.enum(["email", "sms", "push", "whatsapp"]).default("email"),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(5).max(1000),
});

module.exports = {
  listNotificationsQuerySchema,
  updatePreferencesSchema,
  createTestNotificationSchema,
};
