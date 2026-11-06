import { ArrowUpRight } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import SearchSelect from '../components/SearchSelect'
import { customersApi, ledgerApi } from '../lib/api'
import { formatDate, formatMoney } from '../lib/billShare'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const TYPE_LABEL = {
  bill: 'Bill',
  payment: 'Payment',
  refund: 'Refund',
  reversal: 'Reversal',
  advance: 'Advance',
  return: 'Return',
  adjustment: 'Adjustment',
}

function moneyCell(amount) {
  return Number(amount) > 0 ? formatMoney(amount) : '—'
}

function byStatementOrder(a, b) {
  const time = new Date(a.entryDate) - new Date(b.entryDate)
  if (time) return time
  const posted = new Date(a.createdAt) - new Date(b.createdAt)
  if (posted) return posted
  return String(a._id).localeCompare(String(b._id))
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export default function CustomerLedger() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { refreshKey } = useSync()
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [customersReady, setCustomersReady] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [entries, setEntries] = useState([])
  const [entriesReady, setEntriesReady] = useState(!customerId)

  useEffect(() => {
    let active = true
    customersApi
      .list()
      .then((data) => {
        if (active) setCustomers(Array.isArray(data) ? data : [])
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
    if (!customerId) {
      setCustomer(null)
      setEntries([])
      setEntriesReady(true)
      return undefined
    }
    let active = true
    setEntriesReady(false)
    ledgerApi
      .list({ customerId })
      .then((data) => {
        if (!active) return
        setCustomer(data.customer || null)
        setEntries(data.customer ? data.entries || [] : [])
      })
      .catch((err) => {
        if (active) {
          setCustomer(null)
          setEntries([])
          toast.error(err.message)
        }
      })
      .finally(() => {
        if (active) setEntriesReady(true)
      })
    return () => {
      active = false
    }
  }, [customerId, refreshKey, toast])

  const rows = useMemo(() => {
    let balance = 0
    return [...entries].sort(byStatementOrder).map((entry) => {
      balance = roundMoney(balance + (Number(entry.debit) || 0) - (Number(entry.credit) || 0))
      return { ...entry, running: balance }
    })
  }, [entries])
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, entry) => ({
          debit: sum.debit + (Number(entry.debit) || 0),
          credit: sum.credit + (Number(entry.credit) || 0),
        }),
        { debit: 0, credit: 0 }
      ),
    [rows]
  )
  const outstanding = Number(customer?.balance) || 0

  if (!customersReady) return <LogoLoader page />

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <h1>Ledger</h1>
      </header>

      <SearchSelect
        placeholder="Search customer by name or mobile"
        options={customers}
        value={customerId || ''}
        onSelect={(picked) => navigate(`/ledger/${picked._id}`)}
        getKey={(item) => item._id}
        getLabel={(item) => item.name}
        getHint={(item) =>
          [item.mobile || 'No mobile', formatMoney(item.balance)].filter(Boolean).join(' · ')
        }
      />

      {!customerId && (
        <div className="panel empty-state">Select a customer to open the ledger.</div>
      )}

      {customerId && !entriesReady && <LogoLoader panel />}

      {customerId && entriesReady && !customer && (
        <div className="panel empty-state">This customer could not be found.</div>
      )}

      {customer && entriesReady && (
        <>
          <section className="ledger-head">
            <div>
              <h2>{customer.name}</h2>
              <p className="muted">{customer.mobile || 'No mobile'}</p>
            </div>
            <dl className="ledger-summary">
              <div>
                <dt>Debit</dt>
                <dd className="is-debit">{formatMoney(totals.debit)}</dd>
              </div>
              <div>
                <dt>Credit</dt>
                <dd className="is-credit">{formatMoney(totals.credit)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd className={outstanding > 0 ? 'is-debit' : outstanding < 0 ? 'is-credit' : ''}>
                  {formatMoney(outstanding)}
                </dd>
              </div>
            </dl>
          </section>

          <div className="panel table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Reference</th>
                  <th className="money">Debit</th>
                  <th className="money">Credit</th>
                  <th className="money">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry._id}>
                    <td data-label="Date">{formatDate(entry.entryDate)}</td>
                    <td data-label="Particulars">
                      {entry.note || TYPE_LABEL[entry.type] || 'Entry'}
                    </td>
                    <td data-label="Reference">
                      {entry.bills?.length ? (
                        <span className="ledger-refs">
                          {entry.bills.map((bill) => (
                            <Link className="ledger-ref" key={bill.billId} to={`/bills/${bill.billId}`}>
                              {bill.billNo}
                              <ArrowUpRight size={14} weight="bold" />
                            </Link>
                          ))}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`money${Number(entry.debit) > 0 ? ' is-debit' : ''}`} data-label="Debit">
                      {moneyCell(entry.debit)}
                    </td>
                    <td className={`money${Number(entry.credit) > 0 ? ' is-credit' : ''}`} data-label="Credit">
                      {moneyCell(entry.credit)}
                    </td>
                    <td className="money" data-label="Balance">
                      {formatMoney(entry.running)}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6}>No ledger entries for this customer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
