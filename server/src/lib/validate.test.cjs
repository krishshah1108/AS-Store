const test = require('node:test')
const assert = require('node:assert/strict')
const { mobileDigits, mobileError, moneyError, duplicateName } = require('./validate')

test('mobile number is exactly 10 digits', () => {
  assert.equal(mobileDigits('98 765-43210'), '9876543210')
  assert.equal(mobileError('', false), '')
  assert.equal(mobileError('', true), 'Enter a 10-digit mobile number')
  assert.match(mobileError('98765'), /10 digits/)
  assert.match(mobileError('987654321099'), /10 digits/)
  assert.equal(mobileError('9876543210'), '')
  assert.equal(mobileError('9876543210', true), '')
})

test('money rejects blank when required and rejects negatives', () => {
  assert.match(moneyError('', 'Sale price', { required: true }), /Enter Sale price/)
  assert.equal(moneyError('', 'Discount'), '')
  assert.match(moneyError(-1, 'Rate'), /negative/)
  assert.equal(moneyError(0, 'Sale price', { required: true }), '')
  assert.equal(moneyError('12.5', 'Cash'), '')
})

test('duplicate product names ignore case and the row being edited', () => {
  const rows = [
    { _id: 'a', name: 'Acrylic Sheet' },
    { _id: 'b', name: 'LED Panel' },
  ]
  assert.equal(duplicateName(rows, ' acrylic sheet '), true)
  assert.equal(duplicateName(rows, 'Acrylic Sheet', 'a'), false)
  assert.equal(duplicateName(rows, 'New item'), false)
})
