const test = require('node:test')
const assert = require('node:assert/strict')
const { billChanges, mergeBillActivity } = require('./billAudit')

function sample(patch = {}) {
  return {
    customerId: 'a'.repeat(24),
    billDate: '2026-11-06T00:00:00.000Z',
    items: [{ name: 'Ribbon', qty: 2, rate: 300 }],
    subtotal: 600,
    discount: 0,
    total: 600,
    payments: { cash: 0, upi: 0, credit: 600 },
    paidAmount: 0,
    dueAmount: 600,
    status: 'final',
    notes: '',
    ...patch,
  }
}

test('an unchanged bill has no audit diff', () => {
  const bill = sample()
  assert.deepEqual(billChanges(bill, sample()), [])
})

test('a split payment records only the amounts that changed', () => {
  const changes = billChanges(
    sample(),
    sample({
      payments: { cash: 100, upi: 500, credit: 0 },
      paidAmount: 600,
      dueAmount: 0,
    })
  )
  const fields = changes.map((change) => change.field)
  assert.deepEqual(fields.sort(), ['dueAmount', 'paidAmount', 'payments.cash', 'payments.credit', 'payments.upi'].sort())
})

test('the same customer id is not reported as a change', () => {
  const id = 'b'.repeat(24)
  const changes = billChanges(sample({ customerId: id }), sample({ customerId: { _id: id } }))
  assert.equal(changes.some((change) => change.field === 'customerId'), false)
})

test('activity always includes who created the bill', () => {
  const bill = {
    _id: 'bill1',
    createdAt: '2026-11-06T10:00:00.000Z',
    createdBy: { _id: 'user1', name: 'Dhruv' },
    revisions: [],
  }
  const events = mergeBillActivity(bill, [])
  assert.equal(events.length, 1)
  assert.equal(events[0].action, 'create')
  assert.equal(events[0].by.name, 'Dhruv')
})

test('a later edit is listed before the original create', () => {
  const bill = {
    _id: 'bill1',
    createdAt: '2026-11-06T10:00:00.000Z',
    createdBy: { _id: 'user1', name: 'Dhruv' },
    revisions: [],
  }
  const events = mergeBillActivity(bill, [
    {
      _id: 'log1',
      action: 'update',
      summary: 'Edited the bill',
      createdAt: '2026-11-06T12:00:00.000Z',
      performedBy: { _id: 'user2', name: 'Asha' },
      changes: [{ field: 'total', label: 'Total', from: 600, to: 500 }],
    },
  ])
  assert.equal(events[0].by.name, 'Asha')
  assert.equal(events[1].action, 'create')
})
