const {
  createTestNotificationSchema,
  listNotificationsQuerySchema,
  updatePreferencesSchema,
} = require("./notifications.validation");

function createNotificationsController({ notificationsService }) {
  async function listMine(req, res) {
    const query = listNotificationsQuerySchema.parse(req.query);
    const notifications = await notificationsService.listForUser({
      userId: req.auth.sub,
      query,
    });
    return res.status(200).json({ notifications });
  }

  async function getPreferences(req, res) {
    const preferences = await notificationsService.getPreferences(req.auth.sub);
    return res.status(200).json(preferences);
  }

  async function updatePreferences(req, res) {
    const input = updatePreferencesSchema.parse(req.body);
    const preferences = await notificationsService.updatePreferences({
      userId: req.auth.sub,
      input,
    });
    return res.status(200).json(preferences);
  }

  async function createTestNotification(req, res) {
    const input = createTestNotificationSchema.parse(req.body);
    const notification = await notificationsService.createSystemNotification({
      recipientUserId: req.auth.sub,
      channel: input.channel,
      title: input.title,
      body: input.body,
      metadata: {
        type: "manual-test",
      },
    });

    return res.status(201).json({ notification });
  }

  return {
    listMine,
    getPreferences,
    updatePreferences,
    createTestNotification,
  };
}

module.exports = {
  createNotificationsController,
};
