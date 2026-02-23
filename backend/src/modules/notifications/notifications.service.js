const { createNotificationDispatcher } = require("./notification.dispatcher");

const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  whatsappEnabled: false,
};

function toPreferences(preferences) {
  return {
    userId: preferences.user_id,
    emailEnabled: preferences.email_enabled,
    smsEnabled: preferences.sms_enabled,
    pushEnabled: preferences.push_enabled,
    whatsappEnabled: preferences.whatsapp_enabled,
    createdAt: preferences.created_at,
    updatedAt: preferences.updated_at,
  };
}

function toNotification(notification) {
  return {
    id: notification.id,
    recipientUserId: notification.recipient_user_id,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    status: notification.status,
    metadata: notification.metadata ?? {},
    scheduledAt: notification.scheduled_at,
    sentAt: notification.sent_at,
    createdAt: notification.created_at,
  };
}

function channelAllowed(preferences, channel) {
  if (channel === "email") return preferences.emailEnabled;
  if (channel === "sms") return preferences.smsEnabled;
  if (channel === "push") return preferences.pushEnabled;
  if (channel === "whatsapp") return preferences.whatsappEnabled;
  return false;
}

function toRecipientContact(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
  };
}

function createNotificationsService({
  notificationsRepository,
  env,
  notificationDispatcher = createNotificationDispatcher({ env }),
}) {
  async function ensurePreferences(userId) {
    const existing = await notificationsRepository.getPreferencesByUserId(userId);
    if (existing) {
      return existing;
    }

    return notificationsRepository.upsertPreferences({
      userId,
      ...DEFAULT_PREFERENCES,
    });
  }

  async function listForUser({ userId, query }) {
    const rows = await notificationsRepository.listForUser(userId, query);
    return rows.map(toNotification);
  }

  async function getPreferences(userId) {
    const preferences = await ensurePreferences(userId);
    return toPreferences(preferences);
  }

  async function updatePreferences({ userId, input }) {
    const existing = await getPreferences(userId);
    const updated = await notificationsRepository.upsertPreferences({
      userId,
      emailEnabled: input.emailEnabled ?? existing.emailEnabled,
      smsEnabled: input.smsEnabled ?? existing.smsEnabled,
      pushEnabled: input.pushEnabled ?? existing.pushEnabled,
      whatsappEnabled: input.whatsappEnabled ?? existing.whatsappEnabled,
    });
    return toPreferences(updated);
  }

  async function createSystemNotification({
    recipientUserId,
    channel = "email",
    title,
    body,
    metadata = {},
  }) {
    const preferences = await getPreferences(recipientUserId);
    if (!channelAllowed(preferences, channel)) {
      return null;
    }

    const recipient = toRecipientContact(
      await notificationsRepository.findRecipientContact(recipientUserId),
    );

    let deliveryResult;
    try {
      deliveryResult = await notificationDispatcher.send({
        channel,
        recipient,
        title,
        body,
        metadata,
      });
    } catch (error) {
      deliveryResult = {
        status: "failed",
        provider: channel,
        error: error.message ?? "Notification dispatch failed.",
      };
    }

    const created = await notificationsRepository.createNotification({
      recipientUserId,
      channel,
      title,
      body,
      status: deliveryResult.status === "sent" ? "sent" : "failed",
      metadata: {
        ...metadata,
        delivery: deliveryResult,
      },
    });
    return toNotification(created);
  }

  return {
    listForUser,
    getPreferences,
    updatePreferences,
    createSystemNotification,
  };
}

module.exports = {
  createNotificationsService,
  DEFAULT_PREFERENCES,
};
