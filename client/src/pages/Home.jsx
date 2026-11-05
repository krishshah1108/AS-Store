import {
  CurrencyInr,
  Notebook,
  Receipt,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi } from '../lib/api'
import { formatMoney } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function Home() {
  const { refreshKey } = useSync()
  const toast = useToast()
  const [dash, setDash] = useState(null)

  useEffect(() => {
    reportsApi
      .dashboard()
      .then(setDash)
      .catch((err) => toast.error(err.message))
  }, [refreshKey, toast])

  return (
    <div className="page">
      <header className="page-header dash-header">
        <div>
          <h1>Today’s accounts</h1>
          <p className="muted">
            {dash
              ? `${dash.billCount === 1 ? '1 bill' : `${dash.billCount || 0} bills`} today · ${formatMoney(dash.salesTotal)} sold`
              : 'Sales, collections, and outstanding for today.'}
          </p>
        </div>
        <div className="row-actions">
          <Link className="btn primary" to="/bills/new">
            <Receipt size={16} weight="bold" />
            New bill
          </Link>
          <Link className="btn ghost" to="/ledger">
            <Notebook size={16} weight="bold" />
            Ledger
          </Link>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <span className="label-with-icon">
            <Receipt size={16} weight="regular" /> Today’s sales
          </span>
          <strong>{formatMoney(dash?.salesTotal)}</strong>
          <small className="muted">{dash?.billCount || 0} bills</small>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <CurrencyInr size={16} weight="regular" /> Cash
          </span>
          <strong>{formatMoney(dash?.netCash)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <CurrencyInr size={16} weight="regular" /> UPI
          </span>
          <strong>{formatMoney(dash?.netUpi)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <Notebook size={16} weight="regular" /> Credit given
          </span>
          <strong>{formatMoney(dash?.creditGiven)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <CurrencyInr size={16} weight="regular" /> Credit recovered
          </span>
          <strong>{formatMoney(dash?.creditRecovered)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <WarningCircle size={16} weight="regular" /> Total outstanding
          </span>
          <strong className="due-amt">{formatMoney(dash?.outstandingTotal)}</strong>
        </div>
        <div className="stat">
          <span className="label-with-icon">
            <UsersThree size={16} weight="regular" /> Pending customers
          </span>
          <strong>{dash?.pendingCustomers?.length || 0}</strong>
        </div>
      </div>

      <div className="split">
        <div className="panel table-wrap">
          <h2>Overdue{dash ? ` (${dash.overdueDays}+ days)` : ''}</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Bill</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.overdueBills || []).slice(0, 8).map((b) => (
                <tr key={b._id}>
                  <td data-label="Customer">{b.customerId?.name || '—'}</td>
                  <td data-label="Bill">
                    <Link to={`/bills/${b._id}`}>{b.billNo}</Link>
                  </td>
                  <td data-label="Due" className="due-amt">{formatMoney(b.dueAmount)}</td>
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
              {(dash?.pendingCustomers || []).slice(0, 8).map((c) => (
                <tr key={c._id}>
                  <td data-label="Customer">{c.name}</td>
                  <td data-label="Balance" className="due-amt">{formatMoney(c.balance)}</td>
                  <td className="row-actions">
                    <Link className="btn ghost" to={`/ledger/${c._id}`}>
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
    </div>
  )
}
