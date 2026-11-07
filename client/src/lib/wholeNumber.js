/** Keep only whole numbers for qty fields (empty string allowed while typing). */
export function wholeNumberInput(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  if (digits === '') return ''
  return String(Number(digits))
}

export function parseWholeQty(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
