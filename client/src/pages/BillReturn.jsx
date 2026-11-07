import { ArrowUUpLeft } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import BillContextBar from '../components/BillContextBar'
import LogoLoader from '../components/LogoLoader'
import useBill, { billIsLocked } from '../hooks/useBill'
import { billsApi } from '../lib/api'
import { wholeNumberInput, parseWholeQty } from '../lib/wholeNumber'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function BillReturn() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { bump } = useSync()
  const toast = useToast()
  const { bill, ready } = useBill(id)
  const [returnQty, setReturnQty] = useState({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!ready) return <LogoLoader page />
  if (!bill) {
    return (
      <div className="page">
        <Breadcrumbs />
        <div className="panel empty-state">Bill not found.</div>
      </div>
    )
  }

  if (billIsLocked(bill)) {
    return <Navigate to={`/bills/${bill._id}`} replace />
  }

  async function handleReturn() {
    const items = (bill.items || [])
      .map((item, index) => ({
        index,
        name: item.name,
        productId: item.productId,
        rate: item.rate,
        qty: parseWholeQty(returnQty[index]) || 0,
      }))
      .filter((item) => item.qty > 0)

    if (!items.length) {
      toast.error('Enter a whole-number return qty on at least one line')
      return
    }
    const over = items.find((item) => item.qty > Number(bill.items[item.index].qty))
    if (over) {
      toast.error(`Cannot return more than billed qty for ${over.name}`)
      return
    }
    const notWhole = items.find((item) => !Number.isInteger(item.qty))
    if (notWhole) {
      toast.error('Return quantity must be a whole number')
      return
    }

    setSaving(true)
    try {
      await billsApi.returnItems(bill._id, {
        items,
        notes: note.trim() || 'Product return',
      })
      bump()
      toast.success('Return saved')
      navigate(`/bills/${bill._id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page bill-page">
      <Breadcrumbs className="no-print" billNo={bill.billNo} />
      <BillContextBar bill={bill} action="Product return" />

      <section className="panel">
        <h1>Return · {bill.billNo}</h1>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Billed qty</th>
                <th>Return qty</th>
              </tr>
            </thead>
            <tbody>
              {(bill.items || []).map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={item.qty}
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Return qty for ${item.name}`}
                      value={returnQty[index] ?? ''}
                      onChange={(e) =>
                        setReturnQty({ ...returnQty, [index]: wholeNumberInput(e.target.value) })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label>
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional return note"
          />
        </label>
        <div className="row-actions">
          <button type="button" className="btn primary" disabled={saving} onClick={handleReturn}>
            <ArrowUUpLeft size={16} weight="bold" />
            {saving ? 'Saving…' : 'Process return'}
          </button>
          <Link className="btn ghost" to={`/bills/${bill._id}`}>
            Cancel
          </Link>
        </div>
      </section>
    </div>
  )
}
