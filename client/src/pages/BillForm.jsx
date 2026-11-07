import { ArrowLeft, Eye, FloppyDisk, Plus, Trash, WhatsappLogo } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LineProductField from '../components/LineProductField'
import LogoLoader from '../components/LogoLoader'
import SearchSelect from '../components/SearchSelect'
import { billsApi, customersApi, productsApi, settingsApi } from '../lib/api'
import { formatDate, formatMoney, openWhatsAppShare, todayInput } from '../lib/billShare'
import { blankBillLine, placeBillProduct } from '../lib/billLines'
import { wholeNumberInput, parseWholeQty } from '../lib/wholeNumber'
import { billIsLocked } from '../hooks/useBill'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function BillForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const { bump, online } = useSync()
  const { user } = useAuth()
  const toast = useToast()

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [customerId, setCustomerId] = useState('')
  const [billDate, setBillDate] = useState(todayInput())
  const [items, setItems] = useState([blankBillLine()])
  const [discount, setDiscount] = useState(0)
  const [cash, setCash] = useState(0)
  const [upi, setUpi] = useState(0)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [billMeta, setBillMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [catalogReady, setCatalogReady] = useState(false)
  const [billReady, setBillReady] = useState(isNew)
  const [lastBill, setLastBill] = useState(null)
  const locked = billIsLocked(billMeta)

  useEffect(() => {
    let active = true
    Promise.all([
      customersApi.list(),
      productsApi.list(),
      settingsApi.get().catch(() => ({})),
    ])
      .then(([c, p, s]) => {
        if (!active) return
        setCustomers(c)
        setProducts(p.filter((x) => x.isActive !== false))
        setSettings(s || {})
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
      setBillMeta(null)
      return undefined
    }
    let active = true
    setBillReady(false)
    billsApi
      .get(id)
      .then((bill) => {
        if (!active) return
        if (billIsLocked(bill)) {
          navigate(`/bills/${bill._id}`, { replace: true })
          return
        }
        setBillMeta(bill)
        const selectedId = String(bill.customerId?._id || bill.customerId || '')
        setCustomerId(selectedId)
        if (bill.customerId?._id && bill.customerId?.name) {
          setCustomers((list) => {
            if (list.some((row) => String(row._id) === selectedId)) return list
            return [...list, bill.customerId]
          })
        }
        setBillDate(new Date(bill.billDate).toISOString().slice(0, 10))
        setItems([
          ...bill.items.map((item) => ({
            productId: item.productId || '',
            name: item.name,
            qty: item.qty,
            rate: item.rate,
          })),
          blankBillLine(),
        ])
        setDiscount(bill.discount || 0)
        setCash(bill.payments?.cash || 0)
        setUpi(bill.payments?.upi || 0)
        setNotes(bill.notes || '')
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
  }, [id, isNew, navigate, toast])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0),
    [items]
  )
  const total = Math.max(0, subtotal - Number(discount || 0))
  const credit = Math.max(0, total - Number(cash || 0) - Number(upi || 0))
  const cashPaid = Number(cash || 0)
  const upiPaid = Number(upi || 0)
  const hasDue = credit > 0.009
  const cashOn = cashPaid > 0.009
  const upiOn = upiPaid > 0.009
  const creditOn = hasDue

  const customerOptions = customers.filter(
    (c) => c.isActive !== false || String(c._id) === String(customerId || '')
  )
  const productOptions = products.filter((p) => p.isActive !== false)

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function chooseProduct(index, product, options = {}) {
    let notice = ''
    setItems((prev) => {
      const result = placeBillProduct(prev, index, product)
      if (result.addedAgain) notice = `${product.name} is already on this bill. Qty is now ${result.qty}`
      if (options.blankRate && !result.addedAgain) {
        return result.items.map((item, i) => (i === index ? { ...item, rate: '' } : item))
      }
      return result.items
    })
    if (notice) toast.success(notice)
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

  async function createCustomer(name) {
    const trimmed = name.trim()
    const byName = customers.find(
      (customer) => customer.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    const digits = trimmed.replace(/\D/g, '')
    const byMobile =
      digits.length === 10 && digits === trimmed
        ? customers.find((customer) => customer.mobile === digits)
        : null
    const match = byName || byMobile
    if (match) {
      setCustomerId(match._id)
      toast.info(`${match.name} is already a customer`)
      return match
    }
    if (!online) {
      toast.error('The shop server needs to be online to add a customer')
      return null
    }
    try {
      const created = await customersApi.create({
        name: trimmed,
        mobile: digits.length === 10 && digits === trimmed ? digits : '',
        updatedAtClient: new Date().toISOString(),
      })
      setCustomers((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
      setCustomerId(created._id)
      toast.success(`${created.name} added`)
      return created
    } catch (err) {
      toast.error(err.message || 'Could not add the customer')
      return null
    }
  }

  async function createProduct(index, draft) {
    const name = draft.name.trim()
    const match = products.find((product) => product.name.trim().toLowerCase() === name.toLowerCase())
    if (match && match.isActive !== false) {
      chooseProduct(index, match)
      toast.info(`${match.name} is already in the catalogue`)
      return match
    }
    if (!online) {
      toast.error('The shop server needs to be online to add a product')
      return null
    }
    const raw = items[index]?.rate
    const typedRate = raw === '' || raw == null ? null : Number(raw)
    if (typedRate != null && (!Number.isFinite(typedRate) || typedRate < 0)) {
      toast.error('Rate cannot be negative')
      return null
    }
    try {
      const created = await productsApi.create({
        name,
        salePrice: typedRate == null ? 0 : typedRate,
        updatedAtClient: new Date().toISOString(),
      })
      setProducts((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
      chooseProduct(index, created, { blankRate: typedRate == null })
      toast.success(`${created.name} added to the catalogue`)
      return created
    } catch (err) {
      toast.error(err.message || 'Could not add the product')
      return null
    }
  }

  async function rememberRate(index) {
    const item = items[index]
    if (!item?.productId || !online) return
    const product = products.find((row) => String(row._id) === String(item.productId))
    if (!product || Number(product.salePrice) !== 0) return
    if (item.rate === '' || item.rate == null) return
    const price = Number(item.rate)
    if (!Number.isFinite(price) || price <= 0) return
    try {
      const updated = await productsApi.update(product._id, {
        salePrice: price,
        updatedAtClient: new Date().toISOString(),
      })
      setProducts((list) => list.map((row) => (String(row._id) === String(updated._id) ? updated : row)))
    } catch (err) {
      toast.error(err.message)
    }
  }

  function addLine() {
    setItems((prev) => [...prev, blankBillLine()])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function blankBill() {
    setCustomerId('')
    setBillDate(todayInput())
    setItems([blankBillLine()])
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
    if (lines.some((item) => !parseWholeQty(item.qty))) {
      toast.error('Quantity must be a whole number greater than 0')
      return
    }
    const payload = {
      customerId,
      billDate,
      items: lines.map((i) => ({
        productId: i.productId || undefined,
        name: i.name,
        qty: parseWholeQty(i.qty),
        rate: i.rate,
      })),
      discount,
      payments: { cash, upi },
      notes,
      reason: reason || undefined,
    }

    setSaving(true)
    try {
      const bill = isNew ? await billsApi.create(payload) : await billsApi.update(id, payload)
      bump()
      toast.success(isNew ? 'Bill saved' : 'Bill updated')
      if (isNew) {
        const customer = customers.find((item) => String(item._id) === String(customerId))
        setLastBill({
          ...bill,
          customerId: customer
            ? { _id: customer._id, name: customer.name, mobile: customer.mobile }
            : { _id: customerId },
        })
        blankBill()
        window.scrollTo(0, 0)
      } else {
        navigate(`/bills/${bill._id}`)
      }
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!catalogReady || !billReady) return <LogoLoader page />

  return (
    <div className="page bill-page">
      <Breadcrumbs className="no-print" billNo={billMeta?.billNo} />
      <header className="page-header no-print">
        <div>
          <Link to={isNew ? '/bills' : `/bills/${id}`} className="back-link">
            <ArrowLeft size={16} weight="bold" />
            {isNew ? 'All bills' : 'View invoice'}
          </Link>
          <h1>{isNew ? 'Add bill' : `Edit ${billMeta?.billNo || 'bill'}`}</h1>
          {!isNew && billMeta && (
            <p className="muted">
              Created by{' '}
              {billMeta.createdBy?.name ||
                (String(billMeta.createdBy?._id || billMeta.createdBy) === String(user?.id)
                  ? user.name
                  : 'Unknown')}
            </p>
          )}
        </div>
      </header>

      {isNew && lastBill && (
        <section className="panel last-bill no-print" aria-label="Previous bill">
          <Link className="last-bill-copy" to={`/bills/${lastBill._id}`}>
            <p className="last-bill-kicker">Previous bill</p>
            <h2>{lastBill.billNo}</h2>
            <p className="muted">
              {lastBill.customerId?.name || 'Customer'} · {formatDate(lastBill.billDate)} ·{' '}
              {formatMoney(lastBill.total)}
            </p>
          </Link>
          <div className="row-actions">
            <Link className="btn ghost" to={`/bills/${lastBill._id}`} aria-label="Open bill">
              <Eye size={16} weight="bold" />
              Open
            </Link>
            <button type="button" className="btn ghost" onClick={() => openWhatsAppShare(lastBill, settings)}>
              <WhatsappLogo size={16} weight="bold" />
              WhatsApp
            </button>
          </div>
        </section>
      )}

      <form className="bill-layout" onSubmit={onSubmit}>
        <section className="panel bill-sheet">
          <div className="bill-meta">
            <SearchSelect
              label="Customer"
              placeholder="Search a customer, or type a new name"
              options={customerOptions}
              value={customerId}
              getKey={(customer) => customer._id}
              getLabel={(customer) => customer.name}
              getHint={(customer) =>
                `${customer.mobile || 'No mobile'} · ${formatMoney(customer.balance)}`
              }
              onSelect={(customer) => setCustomerId(customer._id)}
              onCreate={locked ? undefined : createCustomer}
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
                    min="1"
                    step="1"
                    inputMode="numeric"
                    aria-label="Quantity"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: wholeNumberInput(e.target.value) || '' })}
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
                    onBlur={() => rememberRate(index)}
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
            <p className="muted">Paid when this bill was made. Later collections use the Payment screen.</p>
            <div className="pay-quick no-print" role="group" aria-label="Quick payment">
              <button type="button" className={cashOn ? 'is-on' : ''} aria-pressed={cashOn} onClick={() => payAll('cash')}>
                Cash
              </button>
              <button type="button" className={upiOn ? 'is-on' : ''} aria-pressed={upiOn} onClick={() => payAll('upi')}>
                UPI
              </button>
              <button
                type="button"
                className={creditOn ? 'is-on' : ''}
                aria-pressed={creditOn}
                onClick={() => payAll('credit')}
              >
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
    </div>
  )
}
