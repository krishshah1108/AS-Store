import {
  CurrencyInr,
  Notebook,
  Receipt,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LogoLoader from '../components/LogoLoader'
import { reportsApi } from '../lib/api'
import { formatMoney } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

function shortMoney(value) {
  const amount = Number(value) || 0
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}k`
  return formatMoney(amount)
}

function TrendChart({ days }) {
  const max = Math.max(...days.map((day) => day.sales), 1)
  return (
    <div className="trend" role="img" aria-label="Sales for the last 7 days">
      {days.map((day) => (
        <div className="trend-col" key={day.date} title={`${day.label}: ${formatMoney(day.sales)}`}>
          <span className="trend-value">{day.sales ? shortMoney(day.sales) : '—'}</span>
          <div className="trend-track">
            <div className="trend-bar" style={{ height: `${Math.max(6, (day.sales / max) * 100)}%` }} />
          </div>
          <span className="trend-label">{day.label}</span>
        </div>
      ))}
    </div>
  )
}

function ProductBars({ products }) {
  const rows = (products || []).slice(0, 6)
  const max = Math.max(...rows.map((row) => row.amount), 1)
  if (!rows.length) return <p className="muted">No sales today.</p>
  return (
    <div className="hbar-list">
      {rows.map((row) => (
        <div className="hbar" key={row.name}>
          <span>{row.name}</span>
          <div className="hbar-track">
            <div style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }} />
          </div>
          <strong>{formatMoney(row.amount)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const { refreshKey } = useSync()
  const toast = useToast()
  const [dash, setDash] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    reportsApi
      .dashboard()
      .then((data) => {
        if (active) setDash(data)
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
  }, [refreshKey, toast])

  if (!ready && !dash) return <LogoLoader page />

  return (
    <div className="page">
      <header className="page-header">
        <h1>Today</h1>
        <div className="row-actions">
          <Link className="btn primary" to="/bills/new">
            <Receipt size={16} weight="bold" />
            Add bill
          </Link>
          <Link className="btn ghost is-ledger" to="/ledger">
            <Notebook size={16} weight="bold" />
            Ledger
          </Link>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <span className="label-with-icon tone-primary">
            <Receipt size={16} weight="regular" /> Sales
          </span>
          <strong>{formatMoney(dash?.salesTotal)}</strong>
          <small className="muted">{dash?.billCount || 0} bills</small>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-success">
            <CurrencyInr size={16} weight="regular" /> Cash
          </span>
          <strong>{formatMoney(dash?.netCash)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-info">
            <CurrencyInr size={16} weight="regular" /> UPI
          </span>
          <strong>{formatMoney(dash?.netUpi)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-accent">
            <Notebook size={16} weight="regular" /> Credit given
          </span>
          <strong>{formatMoney(dash?.creditGiven)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-success">
            <CurrencyInr size={16} weight="regular" /> Recovered
          </span>
          <strong>{formatMoney(dash?.creditRecovered)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-danger">
            <WarningCircle size={16} weight="regular" /> Outstanding
          </span>
          <strong className="due-amt">{formatMoney(dash?.outstandingTotal)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-primary">
            <CurrencyInr size={16} weight="regular" /> Advances
          </span>
          <strong>{formatMoney(dash?.advanceTotal)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon tone-warning">
            <UsersThree size={16} weight="regular" /> Customers due
          </span>
          <strong>{dash?.pendingCustomers?.length || 0}</strong>
        </div>
      </div>

      <div className="split">
        <section className="panel">
          <h2>Last 7 days</h2>
          <TrendChart days={dash?.trend || []} />
        </section>
        <section className="panel">
          <h2>Products today</h2>
          <ProductBars products={dash?.products} />
        </section>
      </div>

      <div className="split">
        <div className="panel table-wrap">
          <h2>Bills today</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Bill</th>
                <th>Total</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.recentBills || []).map((bill) => (
                <tr key={bill._id}>
                  <td data-label="Customer">{bill.customerId?.name || '—'}</td>
                  <td data-label="Bill">
                    <Link to={`/bills/${bill._id}`}>{bill.billNo}</Link>
                  </td>
                  <td data-label="Total">{formatMoney(bill.total)}</td>
                  <td data-label="Due" className={bill.dueAmount > 0 ? 'due-amt' : ''}>
                    {formatMoney(bill.dueAmount)}
                  </td>
                </tr>
              ))}
              {!dash?.recentBills?.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No bills today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel table-wrap">
          <h2>Overdue{dash ? ` · ${dash.overdueDays}+ days` : ''}</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Bill</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.overdueBills || []).slice(0, 8).map((bill) => (
                <tr key={bill._id}>
                  <td data-label="Customer">{bill.customerId?.name || '—'}</td>
                  <td data-label="Bill">
                    <Link to={`/bills/${bill._id}`}>{bill.billNo}</Link>
                  </td>
                  <td data-label="Due" className="due-amt">
                    {formatMoney(bill.dueAmount)}
                  </td>
                </tr>
              ))}
              {!dash?.overdueBills?.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    No overdue bills.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel table-wrap">
        <h2>Highest outstanding</h2>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(dash?.pendingCustomers || []).slice(0, 8).map((customer) => (
              <tr key={customer._id}>
                <td data-label="Customer">{customer.name}</td>
                <td data-label="Balance" className="due-amt">
                  {formatMoney(customer.balance)}
                </td>
                <td className="row-actions">
                  <Link className="btn ghost is-ledger" to={`/ledger/${customer._id}`}>
                    <Notebook size={16} weight="bold" />
                    Ledger
                  </Link>
                </td>
              </tr>
            ))}
            {!dash?.pendingCustomers?.length && (
              <tr>
                <td colSpan={3} className="muted">
                  No pending balances.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
