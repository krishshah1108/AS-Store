export function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

export function formatMoney(n) {
  return `₹${Number(n || 0).toFixed(2)}`
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function buildBillText(bill, settings = {}) {
  const customer = bill.customerId || {}
  const lines = [
    settings.shopName ? `*${settings.shopName}*` : null,
    settings.phone ? `Phone: ${settings.phone}` : null,
    `Bill: ${bill.billNo}`,
    `Date: ${formatDate(bill.billDate)}`,
    `Customer: ${customer.name || ''}`,
    customer.mobile ? `Mobile: ${customer.mobile}` : null,
    '',
    ...bill.items.map(
      (item, i) =>
        `${i + 1}. ${item.name} — ${item.qty} ${item.unit} × ${formatMoney(item.rate)} = ${formatMoney(item.amount)}`
    ),
    '',
    `Subtotal: ${formatMoney(bill.subtotal)}`,
    bill.discount ? `Discount: ${formatMoney(bill.discount)}` : null,
    `*Total: ${formatMoney(bill.total)}*`,
    `Cash: ${formatMoney(bill.payments?.cash)} | UPI: ${formatMoney(bill.payments?.upi)} | Credit: ${formatMoney(bill.payments?.credit)}`,
    settings.billFooterNote || null,
  ].filter(Boolean)

  return lines.join('\n')
}

export function openWhatsAppShare(bill, settings = {}) {
  const text = buildBillText(bill, settings)
  const mobile = String(bill.customerId?.mobile || '').replace(/\D/g, '')
  const phone = mobile.length >= 10 ? `91${mobile.slice(-10)}` : ''
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
