import { ArrowLeft } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { formatDate, formatMoney } from '../lib/billShare'
import { billStatusLabel, billStatusTone } from '../hooks/useBill'

export default function BillContextBar({ bill, action }) {
  if (!bill) return null
  const tone = billStatusTone(bill)
  return (
    <div className="bill-context no-print" aria-label="Current bill">
      <Link className="back-link" to={`/bills/${bill._id}`}>
        <ArrowLeft size={16} weight="bold" />
        View invoice
      </Link>
      <div className="bill-context-main">
        <div className="bill-context-id">
          <strong>{bill.billNo}</strong>
          <span className={`invoice-status is-${tone}`}>{billStatusLabel(bill)}</span>
        </div>
        <p>
          {bill.customerId?.name || 'Customer'}
          {bill.customerId?.mobile ? ` · ${bill.customerId.mobile}` : ''}
        </p>
        <p className="muted">
          {formatDate(bill.billDate)} · Total {formatMoney(bill.total)} · Pending{' '}
          {formatMoney(bill.dueAmount)}
        </p>
      </div>
      {action ? <p className="bill-context-action">{action}</p> : null}
    </div>
  )
}
