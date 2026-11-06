const test = require('node:test')
const assert = require('node:assert/strict')
const { settleBillAmounts } = require('./billing')

test('a later payment does not change the original bill amount', () => {
  const first = settleBillAmounts(500, 400, 0)
  assert.equal(first.paidAmount, 400)
  assert.equal(first.dueAmount, 100)
  assert.equal(first.paymentsCredit, 100)

  const second = settleBillAmounts(500, 400, 100)
  assert.equal(second.paidAmount, 500)
  assert.equal(second.dueAmount, 0)
  assert.equal(second.paymentsCredit, 100)
})

test('correcting a bill amount is separate from payments already received', () => {
  const corrected = settleBillAmounts(500, 400, 0)
  assert.equal(corrected.paidAmount, 400)
  assert.equal(corrected.dueAmount, 100)
})

test('a corrected total cannot drop below money already received', () => {
  assert.throws(() => settleBillAmounts(400, 400, 100), /already received/)
})
