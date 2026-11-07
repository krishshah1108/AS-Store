export function blankBillLine() {
  return { productId: '', name: '', qty: 1, rate: '' }
}

export function placeBillProduct(items, index, product) {
  const qtyOnLine = Number(items[index]?.qty) > 0 ? Number(items[index].qty) : 1
  const other = items.findIndex(
    (item, i) => i !== index && item.productId && String(item.productId) === String(product._id)
  )

  let next
  let addedAgain = false
  let qty = qtyOnLine
  if (other >= 0) {
    qty = (Number(items[other].qty) || 0) + qtyOnLine
    next = items
      .map((item, i) => (i === other ? { ...item, qty } : item))
      .filter((_, i) => i !== index)
    addedAgain = true
  } else {
    next = items.map((item, i) =>
      i === index
        ? {
            productId: product._id,
            name: product.name,
            qty: qtyOnLine,
            rate: product.salePrice ?? 0,
          }
        : item
    )
  }

  if (!next.some((item) => !String(item.name || '').trim())) next = [...next, blankBillLine()]
  if (!next.length) next = [blankBillLine()]
  return { items: next, addedAgain, qty }
}
