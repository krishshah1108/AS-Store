import {
  CurrencyInr,
  MagnifyingGlass,
  ArrowUUpLeft,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LogoLoader from '../components/LogoLoader'
import { customersApi, ledgerApi, paymentsApi } from '../lib/api'
import { formatDate, formatMoney, todayInput } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function CustomerLedger() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { refreshKey, bump } = useSync()
  const toast = useToast()

  const [customers, setCustomers] = useState([])
  const [customersReady, setCustomersReady] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(Boolean(customerId))
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(customerId || '')
  const [ledger, setLedger] = useState(null)
  const [tab, setTab] = useState('ledger')

  const [cash, setCash] = useState(0)
  const [upi, setUpi] = useState(0)
  const [allocationMode, setAllocationMode] = useState('fifo')
  const [manualAlloc, setManualAlloc] = useState({})
  const [paymentDate, setPaymentDate] = useState(todayInput())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundCash, setRefundCash] = useState(0)
  const [refundUpi, setRefundUpi] = useState(0)
  const [refundAmount, setRefundAmount] = useState(0)
  const [fromAdvance, setFromAdvance] = useState(true)

  useEffect(() => {
    let active = true
    customersApi
      .list()
      .then((rows) => {
        if (active) setCustomers(rows.filter((c) => c.isActive !== false))
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setCustomersReady(true)
      })
    return () => {
      active = false
    }
  }, [refreshKey, toast])

  useEffect(() => {
    if (!selectedId) {
      setLedger(null)
      setLedgerLoading(false)
      return undefined
    }
    let active = true
    setLedgerLoading(true)
    ledgerApi
      .customer(selectedId)
      .then((data) => {
        if (active) setLedger(data)
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setLedgerLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedId, refreshKey, toast])

  useEffect(() => {
    if (customerId && customerId !== selectedId) setSelectedId(customerId)
  }, [customerId])

  const filteredCustomers = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return customers
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(term) || c.mobile?.toLowerCase().includes(term)
    )
  }, [customers, q])

  function selectCustomer(id) {
    setSelectedId(id)
    setTab('ledger')
    navigate(`/ledger/${id}`, { replace: true })
  }

  async function submitCollection(e) {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    try {
      const allocations =
        allocationMode === 'manual'
          ? Object.entries(manualAlloc)
              .filter(([, amount]) => Number(amount) > 0)
              .map(([billId, amount]) => ({ billId, amount: Number(amount) }))
          : []

      await paymentsApi.collect({
        customerId: selectedId,
        paymentDate,
        amounts: { cash, upi },
        allocationMode,
        allocations,
        notes,
      })
      setCash(0)
      setUpi(0)
      setNotes('')
      setManualAlloc({})
      bump()
      setTab('ledger')
      toast.success('Collection saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitRefund(e) {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    try {
      await paymentsApi.refund({
        customerId: selectedId,
        paymentDate,
        method: refundMethod,
        fromAdvance,
        amounts:
          refundMethod === 'credit_adjustment'
            ? { amount: refundAmount }
            : { cash: refundCash, upi: refundUpi },
        notes,
      })
      setRefundCash(0)
      setRefundUpi(0)
      setRefundAmount(0)
      setNotes('')
      bump()
      setTab('ledger')
      toast.success('Refund saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function applyAdvance() {
    if (!selectedId) return
    setSaving(true)
    try {
      await paymentsApi.applyAdvance(selectedId)
      bump()
      toast.success('Advance applied to open bills')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const customer = ledger?.customer

  if (!customersReady) return <LogoLoader page />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Customer ledger</h1>
          <p className="muted">Outstanding, collections, advances, and refunds.</p>
        </div>
      </header>

      <div className="split ledger-layout">
        <div className="panel">
          <div className="search-wrap">
            <MagnifyingGlass size={18} weight="bold" className="search-icon" />
            <input
              className="search"
              placeholder="Search customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="customer-pick-list">
            {filteredCustomers.map((c) => (
              <button
                key={c._id}
                type="button"
                className={`customer-pick ${selectedId === c._id ? 'active' : ''}`}
                onClick={() => selectCustomer(c._id)}
              >
                <strong>{c.name}</strong>
                <span className="muted">{c.mobile || '—'}</span>
                <span className={c.balance > 0 ? 'due-amt' : ''}>{formatMoney(c.balance)}</span>
              </button>
            ))}
            {!filteredCustomers.length && <p className="muted">No customers.</p>}
          </div>
        </div>

        <div className="panel">
          {ledgerLoading ? (
            <LogoLoader panel />
          ) : !customer ? (
            <p className="muted">Select a customer to view ledger.</p>
          ) : (
            <>
              <div className="ledger-head">
                <div>
                  <h2>{customer.name}</h2>
                  <p className="muted">{customer.mobile || 'No mobile'}</p>
                </div>
                <div className="stat-grid compact">
                  <div className="stat">
                    <span>Outstanding</span>
                    <strong className={customer.balance > 0 ? 'due-amt' : ''}>
                      {formatMoney(customer.balance)}
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Advance</span>
                    <strong>{formatMoney(customer.advanceBalance)}</strong>
                  </div>
                </div>
              </div>

              <div className="tab-row">
                <button
                  type="button"
                  className={tab === 'ledger' ? 'btn primary' : 'btn ghost'}
                  onClick={() => setTab('ledger')}
                >
                  Ledger
                </button>
                <button
                  type="button"
                  className={tab === 'collect' ? 'btn primary' : 'btn ghost'}
                  onClick={() => setTab('collect')}
                >
                  <CurrencyInr size={16} weight="bold" />
                  Collect
                </button>
                <button
                  type="button"
                  className={tab === 'refund' ? 'btn primary' : 'btn ghost'}
                  onClick={() => setTab('refund')}
                >
                  <ArrowUUpLeft size={16} weight="bold" />
                  Refund
                </button>
                {customer.advanceBalance > 0 && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={saving}
                    onClick={applyAdvance}
                  >
                    Apply advance (FIFO)
                  </button>
                )}
              </div>

              {tab === 'ledger' && (
                <>
                  {ledger.openBills?.length > 0 && (
                    <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                      <h3>Open bills</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Bill</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Due</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.openBills.map((b) => (
                            <tr key={b._id}>
                              <td>{b.billNo}</td>
                              <td>{formatDate(b.billDate)}</td>
                              <td>{formatMoney(b.total)}</td>
                              <td className="due-amt">{formatMoney(b.dueAmount)}</td>
                              <td>
                                <Link to={`/bills/${b._id}`} className="btn ghost">
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="table-wrap">
                    <h3>Entries</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Note</th>
                          <th>Debit</th>
                          <th>Credit</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.entries?.map((e) => (
                          <tr key={e._id}>
                            <td>{formatDate(e.entryDate)}</td>
                            <td>{e.type}</td>
                            <td>{e.note || '—'}</td>
                            <td>{e.debit ? formatMoney(e.debit) : '—'}</td>
                            <td>{e.credit ? formatMoney(e.credit) : '—'}</td>
                            <td>{formatMoney(e.balanceAfter)}</td>
                          </tr>
                        ))}
                        {!ledger.entries?.length && (
                          <tr>
                            <td colSpan={6} className="muted">
                              No ledger entries yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tab === 'collect' && (
                <form className="form" onSubmit={submitCollection}>
                  <h3>Record collection</h3>
                  <label>
                    Date
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </label>
                  <div className="form-row">
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
                  <label>
                    Allocation
                    <select
                      value={allocationMode}
                      onChange={(e) => setAllocationMode(e.target.value)}
                    >
                      <option value="fifo">Automatic FIFO (oldest bills first)</option>
                      <option value="manual">Manual bill allocation</option>
                      <option value="none">Deposit as advance only</option>
                    </select>
                  </label>

                  {allocationMode === 'manual' && (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Bill</th>
                            <th>Due</th>
                            <th>Allocate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ledger.openBills || []).map((b) => (
                            <tr key={b._id}>
                              <td>{b.billNo}</td>
                              <td>{formatMoney(b.dueAmount)}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max={b.dueAmount}
                                  step="0.01"
                                  placeholder="Amount"
                                  value={manualAlloc[b._id] || ''}
                                  onChange={(e) =>
                                    setManualAlloc({ ...manualAlloc, [b._id]: e.target.value })
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                          {!ledger.openBills?.length && (
                            <tr>
                              <td colSpan={3} className="muted">
                                No open bills — payment will go to advance.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <label>
                    Notes
                    <input
                      placeholder="Receipt note"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button className="btn primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save collection'}
                  </button>
                </form>
              )}

              {tab === 'refund' && (
                <form className="form" onSubmit={submitRefund}>
                  <h3>Record refund</h3>
                  <label>
                    Date
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Method
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      <option value="cash">Cash payout</option>
                      <option value="upi">UPI payout</option>
                      <option value="mixed">Cash + UPI</option>
                      <option value="credit_adjustment">Credit adjustment (reduce due)</option>
                    </select>
                  </label>

                  {refundMethod === 'credit_adjustment' ? (
                    <label>
                      Amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={fromAdvance}
                          onChange={(e) => setFromAdvance(e.target.checked)}
                        />
                        Pay from advance balance ({formatMoney(customer.advanceBalance)})
                      </label>
                      <div className="form-row">
                        {(refundMethod === 'cash' || refundMethod === 'mixed') && (
                          <label>
                            Cash
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={refundCash}
                              onChange={(e) => setRefundCash(e.target.value)}
                            />
                          </label>
                        )}
                        {(refundMethod === 'upi' || refundMethod === 'mixed') && (
                          <label>
                            UPI
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={refundUpi}
                              onChange={(e) => setRefundUpi(e.target.value)}
                            />
                          </label>
                        )}
                      </div>
                    </>
                  )}

                  <label>
                    Notes
                    <input
                      placeholder="Refund note"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button className="btn primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save refund'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
