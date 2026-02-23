class PostgresNotificationsRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async listForUser(userId, { limit, offset }) {
    const query = `
      SELECT
        id,
        recipient_user_id,
        channel,
        title,
        body,
        status,
        metadata,
        scheduled_at,
        sent_at,
        created_at
      FROM notifications
      WHERE recipient_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3;
    `;
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async createNotification({
    recipientUserId,
    channel,
    title,
    body,
    status = "queued",
    metadata = {},
    scheduledAt = null,
  }) {
    const query = `
      INSERT INTO notifications (
        recipient_user_id,
        channel,
        title,
        body,
        status,
        metadata,
        scheduled_at,
        sent_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END
      )
      RETURNING
        id,
        recipient_user_id,
        channel,
        title,
        body,
        status,
        metadata,
        scheduled_at,
        sent_at,
        created_at;
    `;
    const values = [
      recipientUserId,
      channel,
      title,
      body,
      status,
      JSON.stringify(metadata),
      scheduledAt,
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findNotificationById(notificationId) {
    const query = `
      SELECT
        id,
        recipient_user_id,
        channel,
        title,
        body,
        status,
        metadata,
        scheduled_at,
        sent_at,
        created_at
      FROM notifications
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await this.pool.query(query, [notificationId]);
    return result.rows[0] ?? null;
  }

  async markNotificationDelivery({
    notificationId,
    status,
    metadata,
  }) {
    const query = `
      UPDATE notifications
      SET
        status = $2,
        metadata = notifications.metadata || $3::jsonb,
        sent_at = CASE
          WHEN $2 = 'sent' THEN NOW()
          ELSE sent_at
        END
      WHERE id = $1
      RETURNING
        id,
        recipient_user_id,
        channel,
        title,
        body,
        status,
        metadata,
        scheduled_at,
        sent_at,
        created_at;
    `;
    const result = await this.pool.query(query, [
      notificationId,
      status,
      JSON.stringify(metadata ?? {}),
    ]);
    return result.rows[0] ?? null;
  }

  async getPreferencesByUserId(userId) {
    const query = `
      SELECT
        id,
        user_id,
        email_enabled,
        sms_enabled,
        push_enabled,
        whatsapp_enabled,
        created_at,
        updated_at
      FROM notification_preferences
      WHERE user_id = $1;
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] ?? null;
  }

  async upsertPreferences({
    userId,
    emailEnabled,
    smsEnabled,
    pushEnabled,
    whatsappEnabled,
  }) {
    const query = `
      INSERT INTO notification_preferences (
        user_id,
        email_enabled,
        sms_enabled,
        push_enabled,
        whatsapp_enabled
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE
      SET
        email_enabled = EXCLUDED.email_enabled,
        sms_enabled = EXCLUDED.sms_enabled,
        push_enabled = EXCLUDED.push_enabled,
        whatsapp_enabled = EXCLUDED.whatsapp_enabled,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        email_enabled,
        sms_enabled,
        push_enabled,
        whatsapp_enabled,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [
      userId,
      emailEnabled,
      smsEnabled,
      pushEnabled,
      whatsappEnabled,
    ]);
    return result.rows[0];
  }

  async findRecipientContact(userId) {
    const query = `
      SELECT
        id,
        full_name,
        email,
        phone_number
      FROM users
      WHERE id = $1;
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] ?? null;
  }
}

module.exports = {
  PostgresNotificationsRepository,
};
