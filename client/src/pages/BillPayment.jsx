import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import BillContextBar from '../components/BillContextBar'
import LogoLoader from '../components/LogoLoader'
import useBill, { billIsLocked } from '../hooks/useBill'
import { billsApi } from '../lib/api'
import { formatDate, formatMoney, todayInput } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function BillPayment() {
  const { id } = useParams()
  const { bump } = useSync()
  const toast = useToast()
  const { bill, setBill, ready } = useBill(id)
  const [payments, setPayments] = useState([])
  const [payCash, setPayCash] = useState('')
  const [payUpi, setPayUpi] = useState('')
  const [payDate, setPayDate] = useState(todayInput())
  const [payNote, setPayNote] = useState('')
  const [receiving, setReceiving] = useState(false)

  useEffect(() => {
    if (!id) return undefined
    let active = true
    billsApi
      .payments(id)
      .then((data) => {
        if (active) setPayments(data.payments || [])
      })
      .catch(() => {
        if (active) setPayments([])
      })
    return () => {
      active = false
    }
  }, [id])

  if (!ready) return <LogoLoader page />
  if (!bill) {
    return (
      <div className="page">
        <Breadcrumbs />
        <div className="panel empty-state">Bill not found.</div>
      </div>
    )
  }

  const locked = billIsLocked(bill)
  const due = Number(bill.dueAmount) || 0
  if (locked || due <= 0) {
    return <Navigate to={`/bills/${bill._id}`} replace />
  }

  async function handleReceive(event) {
    event.preventDefault()
    const cashAmount = Number(payCash || 0)
    const upiAmount = Number(payUpi || 0)
    if (cashAmount < 0 || upiAmount < 0) {
      toast.error('Payment cannot be negative')
      return
    }
    if (cashAmount + upiAmount <= 0) {
      toast.error('Enter a cash or UPI amount')
      return
    }
    if (cashAmount + upiAmount > due + 0.009) {
      toast.error('Payment is more than the pending amount')
      return
    }
    setReceiving(true)
    try {
      const result = await billsApi.receivePayment(id, {
        paymentDate: payDate,
        amounts: { cash: cashAmount, upi: upiAmount },
        notes: payNote,
      })
      setBill(result.bill)
      setPayments(result.payments || [])
      setPayCash('')
      setPayUpi('')
      setPayNote('')
      bump()
      toast.success('Payment recorded')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setReceiving(false)
    }
  }

  return (
    <div className="page bill-page">
      <Breadcrumbs className="no-print" billNo={bill.billNo} />
      <BillContextBar bill={bill} action="Receive payment" />

      <section className="panel">
        <h1>Payment · {bill.billNo}</h1>
        <p className="muted">
          Bill amount {formatMoney(bill.total)} · Pending {formatMoney(bill.dueAmount)}
        </p>

        {payments.length ? (
          <ul className="payment-list">
            {payments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <strong>{payment.kind === 'billing' ? 'With the bill' : payment.paymentNo}</strong>
                  <p className="muted">
                    {formatDate(payment.paymentDate)}
                    {payment.notes ? ` · ${payment.notes}` : ''}
                  </p>
                </div>
                <strong>{formatMoney(payment.totalAmount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No money was taken with this bill yet.</p>
        )}

        <form className="bill-receive" onSubmit={handleReceive}>
          <h2>Receive payment</h2>
          <p className="muted">This records the pending amount. It does not change the original bill cash/UPI split.</p>
          <div className="form-row">
            <label>
              Date
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            </label>
            <label>
              Cash
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={payCash}
                onChange={(e) => setPayCash(e.target.value)}
              />
            </label>
            <label>
              UPI
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={payUpi}
                onChange={(e) => setPayUpi(e.target.value)}
              />
            </label>
          </div>
          <label>
            Note
            <input placeholder="Optional" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          </label>
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={receiving}>
              {receiving ? 'Saving…' : 'Receive payment'}
            </button>
            <Link className="btn ghost" to={`/bills/${bill._id}`}>
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
