import { ArrowLeft } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import useBill, { billStatusLabel, billStatusTone } from '../hooks/useBill'
import { formatDate, formatMoney } from '../lib/billShare'
import { useAuth } from '../context/AuthContext'

export default function BillView() {
  const { id } = useParams()
  const { user } = useAuth()
  const { bill, settings, ready } = useBill(id)

  if (!ready) return <LogoLoader page />
  if (!bill) {
    return (
      <div className="page">
        <Breadcrumbs />
        <div className="panel empty-state">Bill not found.</div>
        <Link className="btn ghost" to="/bills">
          Back to bills
        </Link>
      </div>
    )
  }

  const due = Number(bill.dueAmount) || 0
  const creator =
    bill.createdBy?.name ||
    (String(bill.createdBy?._id || bill.createdBy) === String(user?.id) ? user.name : 'Unknown')

  return (
    <div className="page bill-page">
      <Breadcrumbs className="no-print" billNo={bill.billNo} />
      <header className="page-header no-print">
        <div>
          <Link to="/bills" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All bills
          </Link>
          <h1>{bill.billNo}</h1>
          <p className="muted">Created by {creator}</p>
        </div>
      </header>

      <article className="panel invoice-sheet">
        <header className="invoice-sheet-head">
          <div>
            <img className="invoice-sheet-logo" src="/as-logo.png" alt="" />
            <h2>{settings.shopName || 'AS Store'}</h2>
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>Phone: {settings.phone}</p>}
            {settings.upiId && <p>UPI: {settings.upiId}</p>}
          </div>
          <div className="invoice-sheet-meta">
            <p className="invoice-sheet-kicker">Tax invoice</p>
            <strong>{bill.billNo}</strong>
            <span className={`invoice-status is-${billStatusTone(bill)}`}>{billStatusLabel(bill)}</span>
            <p>{formatDate(bill.billDate)}</p>
          </div>
        </header>

        <section className="invoice-sheet-party">
          <h3>Bill to</h3>
          <p>
            <strong>{bill.customerId?.name || 'Customer'}</strong>
          </p>
          {bill.customerId?.mobile && <p>{bill.customerId.mobile}</p>}
        </section>

        <div className="table-wrap">
          <table className="invoice-sheet-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(bill.items || []).map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                  <td>{formatMoney(item.rate)}</td>
                  <td>{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="invoice-sheet-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(bill.subtotal)}</dd>
          </div>
          {Number(bill.discount) > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>−{formatMoney(bill.discount)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>Total</dt>
            <dd>{formatMoney(bill.total)}</dd>
          </div>
          <div>
            <dt>Cash</dt>
            <dd>{formatMoney(bill.payments?.cash)}</dd>
          </div>
          <div>
            <dt>UPI</dt>
            <dd>{formatMoney(bill.payments?.upi)}</dd>
          </div>
          <div>
            <dt>Udhaar</dt>
            <dd>{formatMoney(bill.payments?.credit)}</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd className="is-paid">{formatMoney(bill.paidAmount)}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd className={due > 0 ? 'is-due' : ''}>{formatMoney(due)}</dd>
          </div>
        </dl>

        {bill.notes && (
          <section className="invoice-sheet-notes">
            <h3>Notes</h3>
            <p>{bill.notes}</p>
          </section>
        )}
        {(bill.returnNote || bill.cancelReason) && (
          <section className="invoice-sheet-notes">
            <h3>{bill.status === 'returned' ? 'Return note' : 'Cancel reason'}</h3>
            <p>{bill.returnNote || bill.cancelReason}</p>
          </section>
        )}
        {settings.billFooterNote && <p className="invoice-sheet-footer">{settings.billFooterNote}</p>}
      </article>
    </div>
  )
}
