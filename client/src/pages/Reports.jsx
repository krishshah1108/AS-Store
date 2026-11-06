import { useEffect, useState } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import { reportsApi } from '../lib/api'
import { formatMoney, todayInput } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function Reports() {
  const { refreshKey } = useSync()
  const toast = useToast()
  const [from, setFrom] = useState(todayInput())
  const [to, setTo] = useState(todayInput())
  const [summary, setSummary] = useState(null)
  const [customerRows, setCustomerRows] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([reportsApi.summary(from, to), reportsApi.customers(from, to)])
      .then(([nextSummary, nextCustomers]) => {
        if (!active) return
        setSummary(nextSummary)
        setCustomerRows(nextCustomers)
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
  }, [from, to, refreshKey, toast])

  if (!ready && !summary) return <LogoLoader page />

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="muted">Sales, cash, and credit for the selected dates. Record payments from the bill.</p>
        </div>
        <form className="range-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </form>
      </header>

      {summary && (
        <div className="stat-grid">
          <div className="stat">
            <span>Sales</span>
            <strong>{formatMoney(summary.salesTotal)}</strong>
            <small className="muted">{summary.billCount} bills</small>
          </div>
          <div className="stat">
            <span>Cash</span>
            <strong>{formatMoney(summary.netCash)}</strong>
          </div>
          <div className="stat">
            <span>UPI</span>
            <strong>{formatMoney(summary.netUpi)}</strong>
          </div>
          <div className="stat">
            <span>Credit given</span>
            <strong>{formatMoney(summary.creditGiven)}</strong>
          </div>
          <div className="stat">
            <span>Credit recovered</span>
            <strong>{formatMoney(summary.creditRecovered)}</strong>
          </div>
          <div className="stat">
            <span>Outstanding</span>
            <strong className="due-amt">{formatMoney(summary.outstandingTotal)}</strong>
          </div>
          <div className="stat">
            <span>Advances</span>
            <strong>{formatMoney(summary.advanceTotal)}</strong>
          </div>
        </div>
      )}

      <div className="split">
        <div className="panel table-wrap">
          <h2>Products</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.products || []).slice(0, 30).map((product) => (
                <tr key={product.name}>
                  <td data-label="Product">{product.name}</td>
                  <td data-label="Qty">{product.qty}</td>
                  <td data-label="Amount">{formatMoney(product.amount)}</td>
                </tr>
              ))}
              {!summary?.products?.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    No product sales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel table-wrap">
          <h2>Customers</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Bills</th>
                <th>Sales</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {customerRows.slice(0, 30).map((row) => (
                <tr key={row.customerId}>
                  <td data-label="Customer">{row.customer?.name || '—'}</td>
                  <td data-label="Bills">{row.bills}</td>
                  <td data-label="Sales">{formatMoney(row.sales)}</td>
                  <td data-label="Balance" className={row.customer?.balance > 0 ? 'due-amt' : ''}>
                    {formatMoney(row.customer?.balance)}
                  </td>
                </tr>
              ))}
              {!customerRows.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No customer sales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel table-wrap">
        <h2>Staff</h2>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Bills</th>
              <th>Sales</th>
              <th>Collections</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.staff || []).map((staff) => (
              <tr key={staff.userId}>
                <td data-label="Staff">{staff.name}</td>
                <td data-label="Bills">{staff.bills}</td>
                <td data-label="Sales">{formatMoney(staff.sales)}</td>
                <td data-label="Collections">{formatMoney(staff.collections)}</td>
              </tr>
            ))}
            {!summary?.staff?.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No staff activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
