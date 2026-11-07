const { round2 } = require('./billing')

const ACTION_SUMMARY = {
  create: 'Created the bill',
  update: 'Edited the bill',
  return: 'Recorded a return',
  delete: 'Deleted the bill',
  collect: 'Recorded a payment on the bill',
}

const FIELDS = [
  { field: 'customerId', label: 'Customer', kind: 'id' },
  { field: 'billDate', label: 'Bill date', kind: 'date' },
  { field: 'items', label: 'Items', kind: 'items' },
  { field: 'subtotal', label: 'Subtotal', kind: 'money' },
  { field: 'discount', label: 'Discount', kind: 'money' },
  { field: 'total', label: 'Total', kind: 'money' },
  { field: 'payments.cash', label: 'Cash', kind: 'money' },
  { field: 'payments.upi', label: 'UPI', kind: 'money' },
  { field: 'payments.credit', label: 'Udhaar', kind: 'money' },
  { field: 'paidAmount', label: 'Paid', kind: 'money' },
  { field: 'dueAmount', label: 'Credit', kind: 'money' },
  { field: 'status', label: 'Status', kind: 'text' },
  { field: 'notes', label: 'Notes', kind: 'text' },
]

function readPath(source, path) {
  return path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), source)
}

function asId(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') {
    if (value._id) return String(value._id)
    if (typeof value.toHexString === 'function') return value.toHexString()
  }
  return String(value)
}

function asDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function itemText(items) {
  return (items || [])
    .map((item) => `${item.name} × ${item.qty} @ ${item.rate}`)
    .join('; ')
    .slice(0, 180)
}

function present(kind, value, source, field) {
  if (kind === 'id') return asId(value)
  if (kind === 'date') return asDateKey(value)
  if (kind === 'items') return itemText(readPath(source, 'items'))
  if (kind === 'money') {
    if (value == null || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? round2(number) : null
  }
  if (field === 'notes') return String(value || '').trim()
  if (value == null) return ''
  return String(value)
}

function billChanges(before, after) {
  const changes = []
  for (const spec of FIELDS) {
    const from = present(spec.kind, readPath(before, spec.field), before, spec.field)
    const to = present(spec.kind, readPath(after, spec.field), after, spec.field)
    if (from === to) continue
    if ((from == null || from === '') && (to == null || to === '')) continue
    changes.push({ field: spec.field, label: spec.label, from: from === '' ? null : from, to: to === '' ? null : to })
  }
  return changes
}

function person(user) {
  if (!user) return null
  if (typeof user === 'object') {
    return { _id: user._id ? String(user._id) : '', name: user.name || '' }
  }
  return { _id: String(user), name: '' }
}

function mergeBillActivity(bill, logs) {
  const events = (logs || []).map((log) => ({
    id: String(log._id),
    action: log.action,
    summary: log.summary || ACTION_SUMMARY[log.action] || 'Updated the bill',
    at: log.createdAt,
    by: person(log.performedBy),
    changes: Array.isArray(log.changes) ? log.changes : [],
  }))

  if (!events.some((event) => event.action === 'create')) {
    events.push({
      id: `created-${bill._id}`,
      action: 'create',
      summary: ACTION_SUMMARY.create,
      at: bill.createdAt,
      by: person(bill.createdBy),
      changes: [],
    })
  }

  for (const revision of bill.revisions || []) {
    const at = new Date(revision.at).getTime()
    const covered = events.find((event) => {
      if (event.action === 'create' || !event.at || Number.isNaN(at)) return false
      return Math.abs(new Date(event.at).getTime() - at) < 5000
    })
    if (covered) {
      if (revision.reason && (!covered.summary || covered.summary === ACTION_SUMMARY.update)) {
        covered.summary = revision.reason
      }
      if (!covered.changes.length && revision.before && revision.after && revision.before.total !== revision.after.total) {
        covered.changes = [
          { field: 'total', label: 'Total', from: revision.before.total, to: revision.after.total },
        ]
      }
      continue
    }
    const changes = []
    if (revision.before && revision.after && revision.before.total !== revision.after.total) {
      changes.push({
        field: 'total',
        label: 'Total',
        from: revision.before.total,
        to: revision.after.total,
      })
    }
    events.push({
      id: `revision-${at}`,
      action: 'update',
      summary: revision.reason || ACTION_SUMMARY.update,
      at: revision.at,
      by: person(revision.by),
      changes,
    })
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return events
}

module.exports = { ACTION_SUMMARY, billChanges, mergeBillActivity }
