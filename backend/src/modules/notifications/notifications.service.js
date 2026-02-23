const { createNotificationDispatcher } = require("./notification.dispatcher");
const { JOB_TYPES } = require("../jobs/jobs.service");

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
  enqueueJob,
  auditService,
}) {
  function uniqueUserIds(recipientUserIds) {
    return Array.from(
      new Set((recipientUserIds ?? []).filter((value) => Boolean(value))),
    );
  }

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

  async function ensurePreferencesForUsers(userIds) {
    if (userIds.length === 0) {
      return;
    }

    if (notificationsRepository.ensurePreferencesForUsers) {
      await notificationsRepository.ensurePreferencesForUsers(
        userIds,
        DEFAULT_PREFERENCES,
      );
      return;
    }

    await Promise.all(userIds.map((userId) => ensurePreferences(userId)));
  }

  async function getPreferencesMapForUsers(userIds) {
    if (userIds.length === 0) {
      return new Map();
    }

    if (notificationsRepository.getPreferencesByUserIds) {
      const rows = await notificationsRepository.getPreferencesByUserIds(userIds);
      const map = new Map();
      for (const row of rows) {
        map.set(row.user_id, toPreferences(row));
      }
      return map;
    }

    const pairs = await Promise.all(
      userIds.map(async (userId) => [userId, await getPreferences(userId)]),
    );
    return new Map(pairs);
  }

  async function getRecipientMapForUsers(userIds) {
    if (userIds.length === 0) {
      return new Map();
    }

    if (notificationsRepository.findRecipientContactsByUserIds) {
      const rows = await notificationsRepository.findRecipientContactsByUserIds(
        userIds,
      );
      const map = new Map();
      for (const row of rows) {
        map.set(row.id, toRecipientContact(row));
      }
      return map;
    }

    const pairs = await Promise.all(
      userIds.map(async (userId) => [
        userId,
        toRecipientContact(
          await notificationsRepository.findRecipientContact(userId),
        ),
      ]),
    );
    return new Map(pairs);
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

  async function queueNotification({
    recipientUserId,
    channel,
    title,
    body,
    metadata,
  }) {
    const created = await notificationsRepository.createNotification({
      recipientUserId,
      channel,
      title,
      body,
      status: "queued",
      metadata,
    });

    if (!enqueueJob) {
      return dispatchNotification({
        notificationId: created.id,
      });
    }

    const enqueued = await enqueueJob({
      type: JOB_TYPES.NOTIFICATION_DISPATCH,
      payload: {
        notificationId: created.id,
      },
      dedupeKey: `notification:${created.id}`,
      maxAttempts: 6,
    });

    if (auditService) {
      await auditService.logEvent({
        entityType: "notification",
        entityId: created.id,
        action: "notification.queued",
        level: "info",
        metadata: {
          channel,
          recipientUserId,
          enqueued: enqueued.enqueued,
          jobId: enqueued.job.id,
        },
      });
    }

    return toNotification(created);
  }

  async function createBulkSystemNotifications({
    recipientUserIds,
    channel = "email",
    title,
    body,
    metadata = {},
  }) {
    const uniqueRecipients = uniqueUserIds(recipientUserIds);
    if (uniqueRecipients.length === 0) {
      return [];
    }

    await ensurePreferencesForUsers(uniqueRecipients);
    const [preferencesMap, recipientMap] = await Promise.all([
      getPreferencesMapForUsers(uniqueRecipients),
      getRecipientMapForUsers(uniqueRecipients),
    ]);

    const deliverableRecipients = uniqueRecipients.filter((recipientUserId) => {
      const preferences = preferencesMap.get(recipientUserId);
      if (!preferences) {
        return false;
      }
      if (!channelAllowed(preferences, channel)) {
        return false;
      }
      return Boolean(recipientMap.get(recipientUserId));
    });

    const created = await Promise.all(
      deliverableRecipients.map((recipientUserId) =>
        queueNotification({
          recipientUserId,
          channel,
          title,
          body,
          metadata,
        }),
      ),
    );

    return created.filter(Boolean);
  }

  async function createSystemNotification({
    recipientUserId,
    channel = "email",
    title,
    body,
    metadata = {},
  }) {
    const created = await createBulkSystemNotifications({
      recipientUserIds: [recipientUserId],
      channel,
      title,
      body,
      metadata,
    });
    return created[0] ?? null;
  }

  async function dispatchNotification({
    notificationId,
    requestId,
  }) {
    const notification = await notificationsRepository.findNotificationById(
      notificationId,
    );
    if (!notification) {
      throw new Error("Notification not found for dispatch.");
    }

    if (notification.status === "sent") {
      return toNotification(notification);
    }

    const recipient = toRecipientContact(
      await notificationsRepository.findRecipientContact(
        notification.recipient_user_id,
      ),
    );

    let deliveryResult;
    try {
      deliveryResult = await notificationDispatcher.send({
        channel: notification.channel,
        recipient,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata ?? {},
      });
    } catch (error) {
      deliveryResult = {
        status: "failed",
        provider: notification.channel,
        error: error.message ?? "Notification dispatch failed.",
      };
    }

    const updated = await notificationsRepository.markNotificationDelivery({
      notificationId: notification.id,
      status: deliveryResult.status === "sent" ? "sent" : "failed",
      metadata: {
        delivery: deliveryResult,
      },
    });

    if (auditService) {
      await auditService.logEvent({
        entityType: "notification",
        entityId: notification.id,
        action:
          deliveryResult.status === "sent"
            ? "notification.delivered"
            : "notification.delivery_failed",
        level: deliveryResult.status === "sent" ? "info" : "warn",
        requestId,
        metadata: {
          channel: notification.channel,
          recipientUserId: notification.recipient_user_id,
          provider: deliveryResult.provider,
          error: deliveryResult.error,
        },
      });
    }

    if (deliveryResult.status !== "sent") {
      throw new Error(deliveryResult.error ?? "Notification delivery failed.");
    }

    return toNotification(updated);
  }

  async function processDispatchJob(job) {
    return dispatchNotification({
      notificationId: job.payload?.notificationId,
    });
  }

  return {
    listForUser,
    getPreferences,
    updatePreferences,
    createBulkSystemNotifications,
    createSystemNotification,
    dispatchNotification,
    processDispatchJob,
  };
}

module.exports = {
  createNotificationsService,
  DEFAULT_PREFERENCES,
};
