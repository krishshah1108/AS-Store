import { ArrowUpRight } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import SearchSelect from '../components/SearchSelect'
import { customersApi, ledgerApi } from '../lib/api'
import { formatDate, formatMoney, formatTime } from '../lib/billShare'
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

const NOTE_SPLITS = [
  /^(Edit reverse)\s+(.+)$/i,
  /^(Delete bill payment reverse)\s+(.+)$/i,
  /^(Delete bill)\s+(.+)$/i,
  /^(Reversal of payment on)\s+(.+)$/i,
  /^(Reversal of bill)\s+(.+)$/i,
  /^(Reclass collection on deleted)\s+(.+)$/i,
  /^(Return surplus)\s+(.+)$/i,
  /^(Return on)\s+(.+)$/i,
  /^(Payment on)\s+(.+)$/i,
  /^(Payment)\s+(.+)$/i,
  /^(Bill)\s+(.+)$/i,
  /^(Refund)\s+(.+)$/i,
  /^(Advance)\s+(.+)$/i,
  /^(Adjustment)\s+(.+)$/i,
]

function particularsParts(entry) {
  const typeLabel = TYPE_LABEL[entry.type] || 'Entry'
  const note = String(entry.note || '').trim()
  if (!note) return { title: typeLabel, detail: '' }

  for (const pattern of NOTE_SPLITS) {
    const match = note.match(pattern)
    if (!match) continue
    let title = match[1]
    let detail = match[2].trim()
    if (/^payment on$/i.test(title)) {
      title = 'Payment'
      detail = `on ${detail}`
    } else if (/^return on$/i.test(title)) {
      title = 'Return'
      detail = `on ${detail}`
    } else if (/^reversal of bill$/i.test(title)) {
      title = 'Reversal'
      detail = `of bill ${detail}`
    } else if (/^reversal of payment on$/i.test(title)) {
      title = 'Reversal'
      detail = `of payment on ${detail}`
    }
    return { title, detail }
  }

  if (note.toLowerCase().startsWith(typeLabel.toLowerCase())) {
    return { title: typeLabel, detail: note.slice(typeLabel.length).trim() }
  }
  return { title: typeLabel, detail: note }
}

function moneyCell(amount) {
  return Number(amount) > 0 ? formatMoney(amount) : '—'
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
  const [totals, setTotals] = useState({ debit: 0, credit: 0 })
  const [outstanding, setOutstanding] = useState(0)
  const [entriesReady, setEntriesReady] = useState(!customerId)
  const [ledgerError, setLedgerError] = useState('')

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
      setTotals({ debit: 0, credit: 0 })
      setOutstanding(0)
      setLedgerError('')
      setEntriesReady(true)
      return undefined
    }
    let active = true
    setEntriesReady(false)
    setLedgerError('')
    ledgerApi
      .list({ customerId })
      .then((data) => {
        if (!active) return
        setCustomer(data.customer || null)
        setEntries(data.customer ? data.entries || [] : [])
        setTotals(data.totals || { debit: 0, credit: 0 })
        setOutstanding(Number(data.outstanding) || 0)
        setLedgerError('')
      })
      .catch((err) => {
        if (active) {
          setCustomer(null)
          setEntries([])
          setTotals({ debit: 0, credit: 0 })
          setOutstanding(0)
          setLedgerError(err.message || 'Could not load this ledger')
          toast.error(err.message || 'Could not load this ledger')
        }
      })
      .finally(() => {
        if (active) setEntriesReady(true)
      })
    return () => {
      active = false
    }
  }, [customerId, refreshKey, toast])

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
        <div className="panel empty-state">
          {ledgerError || 'This customer could not be found.'}
        </div>
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
                {entries.map((entry) => {
                  const { title, detail } = particularsParts(entry)
                  const postedAt = formatTime(entry.createdAt)
                  return (
                  <tr key={entry._id}>
                    <td data-label="Date">
                      <span className="ledger-when">
                        <span className="ledger-when-date">{formatDate(entry.entryDate)}</span>
                        {postedAt ? <span className="ledger-when-time">{postedAt}</span> : null}
                      </span>
                    </td>
                    <td data-label="Particulars">
                      <span className="ledger-particulars">
                        <span className="ledger-particulars-title">{title}</span>
                        {detail ? <span className="ledger-particulars-detail">{detail}</span> : null}
                      </span>
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
                  )
                })}
                {!entries.length && (
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
