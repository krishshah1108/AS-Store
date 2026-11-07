import {
  ArrowUUpLeft,
  CurrencyInr,
  DownloadSimple,
  Eye,
  Info,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import { billsApi, settingsApi } from '../lib/api'
import { downloadBill, formatDate, formatDateTime, formatMoney, openWhatsAppShare } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const ACTION_LABEL = {
  create: 'Created',
  update: 'Edited',
  return: 'Return',
  delete: 'Deleted',
  collect: 'Payment',
}

const MONEY_FIELDS = new Set([
  'subtotal',
  'discount',
  'total',
  'paidAmount',
  'dueAmount',
  'payments.cash',
  'payments.upi',
  'payments.credit',
])

function showChange(field, value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return 'Updated'
  if (MONEY_FIELDS.has(field) && Number.isFinite(Number(value))) return formatMoney(value)
  if (field === 'billDate') return formatDate(value)
  if (field === 'status') {
    const text = String(value)
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return String(value)
}

export default function Bills() {
  const { refreshKey, bump } = useSync()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [settings, setSettings] = useState({})
  const [q, setQ] = useState('')
  const [ready, setReady] = useState(false)
  const [activity, setActivity] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    billsApi
      .list({ q, limit: 100 })
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [refreshKey, q, toast])

  useEffect(() => {
    let active = true
    settingsApi
      .get()
      .then((data) => {
        if (active) setSettings(data || {})
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [refreshKey])

  function openActivity(row) {
    setActivity({ id: row._id, billNo: row.billNo, events: [], loading: true })
    billsApi
      .activity(row._id)
      .then((data) => {
        setActivity((current) => {
          if (!current || current.id !== row._id) return current
          return {
            id: row._id,
            billNo: data.billNo || row.billNo,
            events: data.events || [],
            loading: false,
          }
        })
      })
      .catch((err) => {
        toast.error(err.message)
        setActivity((current) => (current?.id === row._id ? null : current))
      })
  }

  async function shareOrDownload(row, action) {
    try {
      const bill = await billsApi.get(row._id)
      action(bill)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      await billsApi.remove(pendingDelete._id)
      setRows((list) => list.filter((row) => row._id !== pendingDelete._id))
      bump()
      toast.success(`Bill ${pendingDelete.billNo} deleted`)
      setPendingDelete(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (!ready) return <LogoLoader page />

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <h1>Bills</h1>
        </div>
        <Link to="/bills/new" className="btn primary">
          <Plus size={16} weight="bold" />
          Add bill
        </Link>
      </header>

      <div className="toolbar">
        <div className="search-wrap">
          <MagnifyingGlass size={18} weight="bold" className="search-icon" />
          <input
            className="search"
            placeholder="Search bill number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {rows.length ? (
        <ul className="record-list">
          {rows.map((row) => {
            const locked = row.status === 'cancelled' || row.status === 'returned'
            const due = Number(row.dueAmount) || 0
            const paid = Number(row.paidAmount) || 0
            const canPay = due > 0 && !locked
            const canReturn = !locked
            const status = locked
              ? row.status === 'returned'
                ? 'Returned'
                : 'Cancelled'
              : due <= 0
                ? 'Paid'
                : paid > 0
                  ? 'Partial'
                  : 'Unpaid'
            const tone = locked ? 'muted' : due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'due'
            return (
              <li className="invoice-card" key={row._id}>
                <div className="invoice-id">
                  <div className="invoice-id-top">
                    <Link to={`/bills/${row._id}`}>{row.billNo}</Link>
                    <span className={`invoice-status is-${tone}`}>{status}</span>
                  </div>
                  <p>{row.customerId?.name || '—'}</p>
                  <p className="muted">Created by {row.createdBy?.name || 'Unknown'}</p>
                  <time dateTime={row.billDate}>{formatDate(row.billDate)}</time>
                </div>
                <dl className="invoice-money">
                  <div>
                    <dt>Total</dt>
                    <dd>{formatMoney(row.total)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd className="is-paid">{formatMoney(paid)}</dd>
                  </div>
                  <div>
                    <dt>Credit</dt>
                    <dd className={due > 0 ? 'is-due' : ''}>{formatMoney(due)}</dd>
                  </div>
                </dl>
                <div className="invoice-actions">
                  <Link className="invoice-icon" to={`/bills/${row._id}`} aria-label={locked ? 'View bill' : 'Edit bill'}>
                    {locked ? <Eye size={18} /> : <PencilSimple size={18} weight="bold" />}
                  </Link>
                  <button
                    type="button"
                    className="invoice-icon"
                    aria-label="WhatsApp"
                    onClick={() => shareOrDownload(row, (bill) => openWhatsAppShare(bill, settings))}
                  >
                    <WhatsappLogo size={18} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="invoice-icon"
                    aria-label="Download"
                    onClick={() => shareOrDownload(row, (bill) => downloadBill(bill, settings))}
                  >
                    <DownloadSimple size={18} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="invoice-icon is-danger"
                    aria-label="Delete bill"
                    onClick={() => setPendingDelete(row)}
                  >
                    <Trash size={18} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="invoice-icon"
                    aria-label={`Activity for ${row.billNo}`}
                    onClick={() => openActivity(row)}
                  >
                    <Info size={18} />
                  </button>
                  {canReturn && (
                    <Link className="btn ghost invoice-return" to={`/bills/${row._id}#return`}>
                      <ArrowUUpLeft size={16} weight="bold" />
                      <span>Return</span>
                    </Link>
                  )}
                  {canPay && (
                    <Link className="btn primary invoice-pay" to={`/bills/${row._id}#payments`}>
                      <CurrencyInr size={16} weight="bold" />
                      Payment
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="panel empty-state">No bills yet. Create your first bill.</div>
      )}

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => !deleting && setPendingDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bill-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-bill-title">Delete {pendingDelete.billNo}?</h2>
            <p className="muted">
              This removes the bill and updates the customer balance. The deletion cannot be undone.
            </p>
            <div className="row-actions">
              <button type="button" className="btn ghost" disabled={deleting} onClick={() => setPendingDelete(null)}>
                Keep bill
              </button>
              <button type="button" className="btn danger" disabled={deleting} onClick={confirmDelete}>
                <Trash size={16} weight="bold" />
                {deleting ? 'Deleting…' : 'Delete bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activity && (
        <div className="modal-backdrop" onClick={() => setActivity(null)}>
          <div
            className="modal activity-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-activity-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="bill-activity-title">{activity.billNo}</h2>
            <p className="muted">Activity</p>
            {activity.loading ? (
              <p className="muted">Loading activity…</p>
            ) : activity.events.length ? (
              <ol className="activity-list">
                {activity.events.map((event) => (
                  <li className="activity-item" key={event.id}>
                    <div className="activity-head">
                      <strong>{ACTION_LABEL[event.action] || 'Updated'}</strong>
                      <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                    </div>
                    <p>{event.by?.name || 'Unknown'}</p>
                    {event.summary && <p className="muted">{event.summary}</p>}
                    {event.changes?.length > 0 && (
                      <ul className="activity-changes">
                        {event.changes.map((change) => (
                          <li key={`${event.id}-${change.field}`}>
                            {change.label}: {showChange(change.field, change.from)} → {showChange(change.field, change.to)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No activity recorded for this bill.</p>
            )}
            <button type="button" className="btn ghost" onClick={() => setActivity(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
