const AuditLog = require('../models/AuditLog');

async function writeAudit({ action, entityType, entityId, before, after, changes, summary, performedBy, meta }) {
  if (!action || !entityType || !entityId || !performedBy) {
    throw new Error('Audit entry needs an action, record, and user');
  }
  return AuditLog.create({
    action,
    entityType,
    entityId: String(entityId),
    summary: String(summary || '').slice(0, 500),
    changes: Array.isArray(changes) ? changes.slice(0, 40) : [],
    before: before || null,
    after: after || null,
    performedBy,
    meta: meta || null,
  });
}

module.exports = { writeAudit };
