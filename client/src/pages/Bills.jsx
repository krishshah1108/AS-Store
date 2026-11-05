import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LogoLoader from '../components/LogoLoader'
import { billsApi } from '../lib/api'
import { formatDate, formatMoney } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function Bills() {
  const { refreshKey } = useSync()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [ready, setReady] = useState(false)

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

  if (!ready) return <LogoLoader page />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Bills</h1>
          <p className="muted">Create, edit, print, and share sales bills.</p>
        </div>
        <Link to="/bills/new" className="btn primary">
          <Plus size={16} weight="bold" />
          New bill
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
          {rows.map((row) => (
            <li className="record" key={row._id}>
              <div className="record-top">
                <div className="record-title">
                  <Link to={`/bills/${row._id}`}>
                    {row.billNo}
                  </Link>
                  <span className="muted">{row.customerId?.name || '—'}</span>
                  <time className="record-date" dateTime={row.billDate}>
                    {formatDate(row.billDate)}
                  </time>
                </div>
              </div>
              <dl className="record-facts">
                <div>
                  <dt>Total</dt>
                  <dd>{formatMoney(row.total)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{formatMoney(row.paidAmount)}</dd>
                </div>
                <div>
                  <dt>Credit</dt>
                  <dd className={row.dueAmount > 0 ? 'due-amt' : ''}>{formatMoney(row.dueAmount)}</dd>
                </div>
              </dl>
              <div className="row-actions">
                <Link className="btn ghost" to={`/bills/${row._id}`}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel empty-state">No bills yet. Create your first bill.</div>
      )}
    </div>
  )
}
