import {
  ArrowLeft,
  ArrowUUpLeft,
  FloppyDisk,
  Plus,
  Printer,
  Trash,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LineProductField from '../components/LineProductField'
import LogoLoader from '../components/LogoLoader'
import SearchSelect from '../components/SearchSelect'
import { billsApi, customersApi, productsApi, settingsApi } from '../lib/api'
import { formatDate, formatMoney, openWhatsAppShare, todayInput } from '../lib/billShare'
import { placeBillProduct } from '../lib/billLines'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyItem = () => ({
  productId: '',
  name: '',
  qty: 1,
  rate: '',
})

export default function BillForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { bump, online } = useSync()
  const toast = useToast()

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [customerId, setCustomerId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [billDate, setBillDate] = useState(todayInput())
  const [items, setItems] = useState([emptyItem()])
  const [discount, setDiscount] = useState(0)
  const [cash, setCash] = useState(0)
  const [upi, setUpi] = useState(0)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [billMeta, setBillMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [catalogReady, setCatalogReady] = useState(false)
  const [billReady, setBillReady] = useState(isNew)
  const [returnQty, setReturnQty] = useState({})
  const [lastBill, setLastBill] = useState(null)
  const locked = billMeta?.status === 'cancelled' || billMeta?.status === 'returned'

  useEffect(() => {
    let active = true
    Promise.all([customersApi.list(), productsApi.list(), settingsApi.get()])
      .then(([c, p, s]) => {
        if (!active) return
        setCustomers(c.filter((x) => x.isActive !== false))
        setProducts(p.filter((x) => x.isActive !== false))
        setSettings(s)
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setCatalogReady(true)
      })
    return () => {
      active = false
    }
  }, [toast])

  useEffect(() => {
    if (isNew) {
      setBillReady(true)
      return undefined
    }
    let active = true
    setBillReady(false)
    billsApi
      .get(id)
      .then((bill) => {
        if (!active) return
        setBillMeta(bill)
        setCustomerId(bill.customerId?._id || bill.customerId)
        setBillDate(new Date(bill.billDate).toISOString().slice(0, 10))
        const lockedBill = bill.status === 'cancelled' || bill.status === 'returned'
        setItems([
          ...bill.items.map((item) => ({
            productId: item.productId || '',
            name: item.name,
            qty: item.qty,
            rate: item.rate,
          })),
          ...(lockedBill ? [] : [emptyItem()]),
        ])
        setDiscount(bill.discount || 0)
        setCash(bill.payments?.cash || 0)
        setUpi(bill.payments?.upi || 0)
        setNotes(bill.notes || '')
        if (bill.status === 'cancelled' || bill.status === 'returned') {
          const detail = bill.cancelReason || bill.returnNote
          toast.info(detail ? `This bill is ${bill.status}. ${detail}` : `This bill is ${bill.status}.`)
        }
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setBillReady(true)
      })
    return () => {
      active = false
    }
  }, [id, isNew, toast])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0),
    [items]
  )
  const total = Math.max(0, subtotal - Number(discount || 0))
  const credit = Math.max(0, total - Number(cash || 0) - Number(upi || 0))
  const cashPaid = Number(cash || 0)
  const upiPaid = Number(upi || 0)
  const payMode =
    cashPaid > 0 && upiPaid === 0 && Math.abs(cashPaid - total) < 0.01
      ? 'cash'
      : upiPaid > 0 && cashPaid === 0 && Math.abs(upiPaid - total) < 0.01
        ? 'upi'
        : cashPaid === 0 && upiPaid === 0
          ? 'credit'
          : ''

  const customerOptions = customers.filter((c) => c.isActive !== false || c._id === customerId)
  const productOptions = products.filter((p) => p.isActive !== false)

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function chooseProduct(index, product) {
    const result = placeBillProduct(items, index, product)
    setItems(result.items)
    if (result.addedAgain) {
      toast.success(`${product.name} is already on this bill. Qty is now ${result.qty}`)
    }
  }

  function typeProductName(index, text) {
    const current = items[index]
    const selected = products.find((product) => String(product._id) === String(current?.productId))
    if (selected && selected.name === text) {
      updateItem(index, { name: text })
      return
    }
    updateItem(index, { name: text, productId: '', rate: '' })
  }

  async function createProduct(index, draft) {
    const name = draft.name.trim()
    const match = products.find((product) => product.name.trim().toLowerCase() === name.toLowerCase())
    if (match && match.isActive !== false) {
      chooseProduct(index, match)
      toast.info(`${match.name} is already in the catalogue`)
      return match
    }
    if (!online) throw new Error('The shop server needs to be online to add a product')
    const created = await productsApi.create({
      name,
      salePrice: draft.salePrice,
      updatedAtClient: new Date().toISOString(),
    })
    setProducts((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
    chooseProduct(index, created)
    toast.success(`${created.name} added to the catalogue`)
    return created
  }

  function addLine() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function blankBill() {
    setCustomerId('')
    setBillDate(todayInput())
    setItems([emptyItem()])
    setDiscount(0)
    setCash(0)
    setUpi(0)
    setNotes('')
    setReason('')
  }

  function payAll(mode) {
    if (mode === 'cash') {
      setCash(total)
      setUpi(0)
    } else if (mode === 'upi') {
      setUpi(total)
      setCash(0)
    } else {
      setCash(0)
      setUpi(0)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!customerId) {
      toast.error('Select a customer')
      return
    }
    const lines = items.filter((item) => String(item.name || '').trim())
    if (!lines.length) {
      toast.error('Add at least one product line')
      return
    }
    if (lines.some((item) => !item.productId)) {
      toast.error('Choose each product from the list, or add it to the catalogue')
      return
    }
    const payload = {
      customerId,
      billDate,
      items: lines.map((i) => ({
          productId: i.productId || undefined,
          name: i.name,
          qty: i.qty,
          rate: i.rate,
        })),
      discount,
      payments: {
        cash,
        upi,
      },
      notes,
      reason: reason || undefined,
    }

    setSaving(true)
    try {
      const bill = isNew ? await billsApi.create(payload) : await billsApi.update(id, payload)
      bump()
      toast.success(isNew ? 'Bill saved' : 'Bill updated')
      if (isNew) {
        const customer = customers.find((item) => item._id === customerId)
        setLastBill({
          ...bill,
          customerId: customer
            ? { _id: customer._id, name: customer.name, mobile: customer.mobile }
            : { _id: customerId },
        })
        blankBill()
        window.scrollTo(0, 0)
      } else {
        setBillMeta(bill)
        setReason('')
      }
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleWhatsApp() {
    if (!billMeta) return
    openWhatsAppShare(billMeta, settings)
  }

  async function handleDelete() {
    if (!billMeta || saving) return
    setSaving(true)
    try {
      await billsApi.remove(billMeta._id)
      bump()
      toast.success(`Bill ${billMeta.billNo} deleted`)
      navigate('/bills')
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  async function handleReturn() {
    if (!billMeta || locked) return
    const items = (billMeta.items || [])
      .map((item, index) => ({
        index,
        name: item.name,
        productId: item.productId,
        rate: item.rate,
        qty: Number(returnQty[index] || 0),
      }))
      .filter((i) => i.qty > 0)
    if (!items.length) {
      toast.error('Enter return qty on at least one line')
      return
    }
    const over = items.find((item) => item.qty > Number(billMeta.items[item.index].qty))
    if (over) {
      toast.error(`Cannot return more than billed qty for ${over.name}`)
      return
    }
    setSaving(true)
    try {
      const result = await billsApi.returnItems(billMeta._id, {
        items,
        notes: reason || 'Product return',
      })
      setBillMeta(result)
      setReturnQty({})
      setItems(
        result.items.map((item) => ({
          productId: item.productId || '',
          name: item.name,
          qty: item.qty,
          rate: item.rate,
        }))
      )
      setDiscount(result.discount || 0)
      setCash(result.payments?.cash || 0)
      setUpi(result.payments?.upi || 0)
      bump()
      toast.success('Return saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!catalogReady || !billReady) return <LogoLoader page />

  return (
    <div className="page bill-page">
      <header className="page-header no-print">
        <div>
          <Link to="/bills" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All bills
          </Link>
          <h1>{isNew ? 'Add bill' : billMeta?.billNo || 'Edit bill'}</h1>
          <p className="muted">Type a product on the line. Pick a match, or add a new one with its price.</p>
        </div>
        {!isNew && billMeta && (
          <div className="row-actions">
            <Link className="btn ghost" to={`/ledger/${billMeta.customerId?._id || billMeta.customerId}`}>
              Ledger
            </Link>
            <button type="button" className="btn ghost" onClick={handlePrint}>
              <Printer size={16} weight="bold" />
              Print
            </button>
            <button type="button" className="btn ghost" onClick={handleWhatsApp}>
              <WhatsappLogo size={16} weight="bold" />
              WhatsApp
            </button>
            <button type="button" className="btn ghost danger-text" disabled={saving} onClick={() => setConfirmDelete(true)}>
              <Trash size={16} weight="bold" />
              Delete bill
            </button>
          </div>
        )}
      </header>

      {isNew && lastBill && (
        <section className="panel last-bill no-print" aria-label="Previous bill">
          <div className="last-bill-copy">
            <p className="last-bill-kicker">Previous bill</p>
            <h2>
              <Link to={`/bills/${lastBill._id}`}>{lastBill.billNo}</Link>
            </h2>
            <p className="muted">
              {lastBill.customerId?.name || 'Customer'} · {formatDate(lastBill.billDate)} · {formatMoney(lastBill.total)}
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn ghost" to={`/ledger/${lastBill.customerId?._id || lastBill.customerId}`}>
              Ledger
            </Link>
            <button type="button" className="btn ghost" onClick={() => openWhatsAppShare(lastBill, settings)}>
              <WhatsappLogo size={16} weight="bold" />
              WhatsApp
            </button>
          </div>
        </section>
      )}

      <div className="print-only">
        <img className="print-logo" src="/as-logo.png" alt="AS Store" />
        {settings.address && <p>{settings.address}</p>}
        {settings.phone && <p>Phone: {settings.phone}</p>}
        {settings.upiId && <p>UPI: {settings.upiId}</p>}
        <h2>{billMeta?.billNo || 'New bill'}</h2>
      </div>

      <form className="bill-layout" onSubmit={onSubmit}>
        <section className="panel bill-sheet">
          <div className="bill-meta">
            <SearchSelect
              label="Customer"
              placeholder="Search customer, then Enter"
              options={customerOptions}
              value={customerId}
              getKey={(customer) => customer._id}
              getLabel={(customer) => customer.name}
              getHint={(customer) =>
                `${customer.mobile || 'No mobile'} · ${formatMoney(customer.balance)}`
              }
              onSelect={(customer) => setCustomerId(customer._id)}
            />
            <label className="bill-date">
              <span>Bill date</span>
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </label>
          </div>

          <div className="bill-lines">
            <div className="bill-lines-head">
              <span>Product</span>
              <span />
              <span>Qty</span>
              <span>Rate</span>
              <span>Amount</span>
            </div>
            {items.length === 0 && <p className="muted bill-lines-empty">No product lines yet.</p>}
            {items.map((item, index) => (
              <div className="bill-line" key={index}>
                <LineProductField
                  name={item.name}
                  products={productOptions}
                  disabled={locked}
                  onNameChange={(text) => typeProductName(index, text)}
                  onPick={(product) => chooseProduct(index, product)}
                  onCreate={(draft) => createProduct(index, draft)}
                />
                <button
                  type="button"
                  className="btn line-remove no-print"
                  onClick={() => removeItem(index)}
                  disabled={locked}
                  aria-label="Remove product"
                >
                  <Trash size={16} weight="bold" />
                </button>
                <label className="line-qty">
                  <span>Qty</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    aria-label="Quantity"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: e.target.value })}
                  />
                </label>
                <label className="line-rate">
                  <span>Rate</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Rate"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => updateItem(index, { rate: e.target.value })}
                  />
                </label>
                <div className="line-amount">
                  <span>Amount</span>
                  <strong>{formatMoney(Number(item.qty || 0) * Number(item.rate || 0))}</strong>
                </div>
              </div>
            ))}
            <button type="button" className="btn bill-add-line no-print" onClick={addLine} disabled={locked}>
              <Plus size={16} weight="bold" />
              Add product
            </button>
          </div>
        </section>

        <aside className="panel bill-summary">
          <div className="bill-figures">
            <div className="figure figure-subtotal">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className="figure figure-discount">
              <span id="bill-discount-label">Discount</span>
              <input
                aria-labelledby="bill-discount-label"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </div>

          <section className="bill-pay">
            <h2>Payment</h2>
            <div className="pay-quick no-print" role="group" aria-label="Quick payment">
              <button type="button" className={payMode === 'cash' ? 'is-on' : ''} onClick={() => payAll('cash')}>
                Cash
              </button>
              <button type="button" className={payMode === 'upi' ? 'is-on' : ''} onClick={() => payAll('upi')}>
                UPI
              </button>
              <button type="button" className={payMode === 'credit' ? 'is-on' : ''} onClick={() => payAll('credit')}>
                Udhaar
              </button>
            </div>
            <div className="pay-pair">
              <label>
                Cash
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                />
              </label>
              <label>
                UPI
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                />
              </label>
            </div>
            <div className={credit > 0 ? 'credit-due' : 'credit-due is-clear'}>
              <span>{credit > 0 ? 'Udhaar' : 'Paid in full'}</span>
              <strong>{formatMoney(credit)}</strong>
            </div>
          </section>

          <div className="till-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <label>
            Notes
            <textarea
              rows={2}
              placeholder="Optional note on the bill"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {!isNew && (
            <label className="no-print">
              Edit reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why was this bill changed?"
              />
            </label>
          )}

          <button className="btn primary bill-save no-print" disabled={saving || locked} type="submit">
            <FloppyDisk size={18} weight="bold" />
            {saving ? 'Saving…' : isNew ? 'Save bill' : 'Update bill'}
          </button>

          {settings.billFooterNote && <p className="muted">{settings.billFooterNote}</p>}
        </aside>
      </form>

      {!isNew && billMeta && !locked && (
        <section className="panel no-print">
          <h2>Product return</h2>
          <p className="muted">Enter qty to return per line. Surplus paid amount becomes advance.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Billed qty</th>
                  <th>Return qty</th>
                </tr>
              </thead>
              <tbody>
                {(billMeta.items || []).map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        step="0.01"
                        placeholder="0"
                        aria-label={`Return qty for ${item.name}`}
                        value={returnQty[index] || ''}
                        onChange={(e) =>
                          setReturnQty({ ...returnQty, [index]: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn ghost" disabled={saving} onClick={handleReturn}>
            <ArrowUUpLeft size={16} weight="bold" />
            Process return
          </button>
        </section>
      )}

      {!isNew && billMeta?.revisions?.length > 0 && (
        <section className="panel table-wrap no-print">
          <h2>Edit history</h2>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>Reason</th>
                <th>Before total</th>
                <th>After total</th>
              </tr>
            </thead>
            <tbody>
              {[...billMeta.revisions].reverse().map((rev, i) => (
                <tr key={i}>
                  <td>{formatDate(rev.at)}</td>
                  <td>{rev.by?.name || '—'}</td>
                  <td>{rev.reason || '—'}</td>
                  <td>{formatMoney(rev.before?.total)}</td>
                  <td>{formatMoney(rev.after?.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {confirmDelete && billMeta && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bill-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-bill-title">Delete {billMeta.billNo}?</h2>
            <p className="muted">
              This removes the bill and updates the customer balance. The deletion cannot be undone.
            </p>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Keep bill
              </button>
              <button type="button" className="btn danger" disabled={saving} onClick={handleDelete}>
                <Trash size={16} weight="bold" />
                {saving ? 'Deleting…' : 'Delete bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
