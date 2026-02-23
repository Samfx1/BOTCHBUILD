class PostgresAuditRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async createEvent({
    actorUserId = null,
    entityType,
    entityId = null,
    action,
    level = "info",
    requestId = null,
    metadata = {},
  }) {
    const query = `
      INSERT INTO audit_events (
        actor_user_id,
        entity_type,
        entity_id,
        action,
        level,
        request_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING
        id,
        actor_user_id,
        entity_type,
        entity_id,
        action,
        level,
        request_id,
        metadata,
        created_at;
    `;

    const result = await this.pool.query(query, [
      actorUserId,
      entityType,
      entityId,
      action,
      level,
      requestId,
      JSON.stringify(metadata ?? {}),
    ]);

    return result.rows[0];
  }

  async listEvents({ limit, offset, level, entityType }) {
    const filters = [];
    const values = [];

    if (level) {
      values.push(level);
      filters.push(`level = $${values.length}`);
    }

    if (entityType) {
      values.push(entityType);
      filters.push(`entity_type = $${values.length}`);
    }

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT
        id,
        actor_user_id,
        entity_type,
        entity_id,
        action,
        level,
        request_id,
        metadata,
        created_at
      FROM audit_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}

module.exports = {
  PostgresAuditRepository,
};
