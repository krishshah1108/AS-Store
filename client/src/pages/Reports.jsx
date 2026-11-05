import { DownloadSimple, Printer } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import LogoLoader from '../components/LogoLoader'
import { reportsApi } from '../lib/api'
import { formatDate, formatMoney, todayInput } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { refreshKey } = useSync()
  const toast = useToast()
  const [from, setFrom] = useState(todayInput())
  const [to, setTo] = useState(todayInput())
  const [summary, setSummary] = useState(null)
  const [customerRows, setCustomerRows] = useState([])
  const [ready, setReady] = useState(false)

  async function load() {
    try {
      const [s, c] = await Promise.all([
        reportsApi.summary(from, to),
        reportsApi.customers(from, to),
      ])
      setSummary(s)
      setCustomerRows(c)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setReady(true)
    }
  }

  useEffect(() => {
    load()
  }, [from, to, refreshKey])

  if (!ready && !summary) return <LogoLoader page />

  function exportSummary() {
    if (!summary) return
    downloadCsv(`as-store-summary-${from}-to-${to}.csv`, [
      ['Metric', 'Value'],
      ['From', from],
      ['To', to],
      ['Sales', summary.salesTotal],
      ['Bills', summary.billCount],
      ['Cash collected', summary.cashCollected],
      ['UPI collected', summary.upiCollected],
      ['Credit given', summary.creditGiven],
      ['Credit recovered', summary.creditRecovered],
      ['Outstanding', summary.outstandingTotal],
      ['Advances', summary.advanceTotal],
    ])
  }

  function exportProducts() {
    if (!summary?.products) return
    downloadCsv(`as-store-products-${from}-to-${to}.csv`, [
      ['Product', 'Qty', 'Amount'],
      ...summary.products.map((p) => [p.name, p.qty, p.amount]),
    ])
  }

  function exportCustomers() {
    downloadCsv(`as-store-customers-${from}-to-${to}.csv`, [
      ['Customer', 'Mobile', 'Bills', 'Sales', 'Credit', 'Balance'],
      ...customerRows.map((r) => [
        r.customer?.name || r.customerId,
        r.customer?.mobile || '',
        r.bills,
        r.sales,
        r.credit,
        r.customer?.balance || 0,
      ]),
    ])
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="muted">Choose a start and end date to see sales, collections, and ledgers.</p>
        </div>
      </header>

      <section className="panel date-range">
        <div>
          <h2>Date range</h2>
          <p className="muted">
            {formatDate(from)} – {formatDate(to)}
          </p>
        </div>
        <div className="date-range-fields">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={exportSummary}>
            <DownloadSimple size={16} weight="bold" />
            Download
          </button>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            <Printer size={16} weight="bold" />
            Print
          </button>
        </div>
      </section>

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
          <div className="panel-head">
            <h2>Product-wise</h2>
            <button type="button" className="btn ghost" onClick={exportProducts}>
              <DownloadSimple size={16} /> CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.products || []).slice(0, 30).map((p) => (
                <tr key={p.name}>
                  <td data-label="Product">{p.name}</td>
                  <td data-label="Qty">{p.qty}</td>
                  <td data-label="Amount">{formatMoney(p.amount)}</td>
                </tr>
              ))}
              {!summary?.products?.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    No product sales in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel table-wrap">
          <div className="panel-head">
            <h2>Customer-wise</h2>
            <button type="button" className="btn ghost" onClick={exportCustomers}>
              <DownloadSimple size={16} /> CSV
            </button>
          </div>
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
              {customerRows.slice(0, 30).map((r) => (
                <tr key={r.customerId}>
                  <td data-label="Customer">{r.customer?.name || '—'}</td>
                  <td data-label="Bills">{r.bills}</td>
                  <td data-label="Sales">{formatMoney(r.sales)}</td>
                  <td data-label="Balance" className={r.customer?.balance > 0 ? 'due-amt' : ''}>
                    {formatMoney(r.customer?.balance)}
                  </td>
                </tr>
              ))}
              {!customerRows.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No customer sales in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel table-wrap">
        <h2>Staff-wise</h2>
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
            {(summary?.staff || []).map((s) => (
              <tr key={s.userId}>
                <td data-label="Staff">{s.name}</td>
                <td data-label="Bills">{s.bills}</td>
                <td data-label="Sales">{formatMoney(s.sales)}</td>
                <td data-label="Collections">{formatMoney(s.collections)}</td>
              </tr>
            ))}
            {!summary?.staff?.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No staff activity in range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
