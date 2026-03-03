function toAuditEvent(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    level: row.level,
    requestId: row.request_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function createAuditService({ auditRepository }) {
  async function logEvent(input) {
    const created = await auditRepository.createEvent(input);
    return toAuditEvent(created);
  }

  async function listEvents(query) {
    const rows = await auditRepository.listEvents(query);
    return rows.map(toAuditEvent);
  }

  return {
    logEvent,
    listEvents,
  };
}

module.exports = {
  createAuditService,
};
