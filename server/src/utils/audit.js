const AuditLog = require('../models/AuditLog');

async function writeAudit({ action, entityType, entityId, before, after, performedBy, meta }) {
  return AuditLog.create({
    action,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    before: before || null,
    after: after || null,
    performedBy,
    meta: meta || null,
  });
}

module.exports = { writeAudit };
