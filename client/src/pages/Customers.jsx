import { MagnifyingGlass, Notebook, PencilSimple, Plus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import Pager from '../components/Pager'
import StatusSwitch from '../components/StatusSwitch'
import { customersApi } from '../lib/api'
import { formatMoney } from '../lib/billShare'
import { cacheGet, cacheSet, enqueueMutation, newLocalId } from '../lib/storage'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', mobile: '', address: '', notes: '' }

export default function Customers() {
  const { refreshKey, online, refreshPending } = useSync()
  const toast = useToast()
  const [rows, setRows] = useState(() => cacheGet('customers') || [])
  const [ready, setReady] = useState(() => (cacheGet('customers') || []).length > 0)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  async function load() {
    try {
      const data = await customersApi.list()
      cacheSet('customers', data)
      setRows(data)
    } catch {
      setRows(cacheGet('customers') || [])
    } finally {
      setReady(true)
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        r.mobile?.toLowerCase().includes(term) ||
        r.address?.toLowerCase().includes(term)
    )
  }, [rows, q])

  useEffect(() => {
    setPage(1)
  }, [q])

  if (!ready) return <LogoLoader page />

  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function startEdit(row) {
    setEditing(row)
    setFormOpen(true)
    setForm({
      name: row.name || '',
      mobile: row.mobile || '',
      address: row.address || '',
      notes: row.notes || '',
    })
  }

  function resetForm() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(false)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      updatedAtClient: new Date().toISOString(),
    }

    try {
      if (!online) {
        const next = rows.map((r) =>
          r._id === editing._id ? { ...r, ...payload, _pending: true } : r
        )
        setRows(next)
        cacheSet('customers', next)
        enqueueMutation({
          id: newLocalId(),
          entity: 'customer',
          op: 'update',
          payload: { ...payload, _id: editing._id },
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        resetForm()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        await customersApi.update(editing._id, payload)
        resetForm()
        await load()
        toast.success('Customer updated')
      }
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row, isActive) {
    const payload = {
      name: row.name,
      mobile: row.mobile,
      address: row.address,
      notes: row.notes,
      isActive,
      updatedAtClient: new Date().toISOString(),
    }
    try {
      if (!online) {
        const next = rows.map((r) => (r._id === row._id ? { ...r, ...payload, _pending: true } : r))
        setRows(next)
        cacheSet('customers', next)
        enqueueMutation({
          id: newLocalId(),
          entity: 'customer',
          op: 'update',
          payload: { ...payload, _id: row._id },
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        setRows((list) => list.map((item) => (item._id === row._id ? { ...item, isActive } : item)))
        await customersApi.update(row._id, payload)
        toast.success(isActive ? 'Customer activated' : 'Customer deactivated')
      }
    } catch (err) {
      if (online) {
        setRows((list) => list.map((item) => (item._id === row._id ? { ...item, isActive: row.isActive } : item)))
      }
      toast.error(err.message)
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <h1>Customers</h1>
        </div>
        <Link to="/customers/new" className="btn primary">
          <Plus size={16} weight="bold" />
          Add customer
        </Link>
      </header>

      {formOpen && (
        <form className="panel form editor" onSubmit={onSubmit}>
          <h2>Edit customer</h2>
          <label>
            Name *
            <input
              required
              placeholder="Customer name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Mobile
            <input
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit mobile number, or leave it blank"
              placeholder="10-digit mobile number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
            />
          </label>
          <label>
            Address
            <input
              placeholder="Shop or home address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label>
            Notes
            <textarea
              rows={3}
              placeholder="Credit terms or other notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="row-actions">
            <button className="btn primary" disabled={saving} type="submit">
              <PencilSimple size={16} weight="bold" />
              {saving ? 'Saving…' : 'Update'}
            </button>
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="search-wrap">
          <MagnifyingGlass size={18} weight="bold" className="search-icon" />
          <input
            className="search"
            placeholder="Search name, mobile, address…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {filtered.length ? (
        <ul className="record-list">
          {visible.map((row) => (
            <li className={`record ${row.isActive === false ? 'is-inactive' : 'is-active'}`} key={row._id}>
              <div className="record-top">
                <div className="record-title">
                  <strong>
                    {row.name}
                    {row._pending && <span className="tag">pending</span>}
                  </strong>
                  <span className="muted">{row.mobile || 'No mobile'}</span>
                </div>
              </div>
              <dl className="record-facts">
                <div>
                  <dt>Balance</dt>
                  <dd className={row.balance > 0 ? 'due-amt' : ''}>
                    {formatMoney(row.balance)}
                  </dd>
                </div>
                <div>
                  <dt>Advance</dt>
                  <dd>{formatMoney(row.advanceBalance)}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{row.address || '—'}</dd>
                </div>
              </dl>
              <div className="row-actions">
                <Link className="btn ghost" to={`/ledger/${row._id}`}>
                  <Notebook size={16} weight="bold" />
                  Ledger
                </Link>
                <button type="button" className="btn ghost" onClick={() => startEdit(row)}>
                  <PencilSimple size={16} weight="bold" />
                  Edit
                </button>
                <StatusSwitch
                  checked={row.isActive !== false}
                  label={`${row.isActive === false ? 'Activate' : 'Deactivate'} ${row.name}`}
                  onChange={(isActive) => toggleActive(row, isActive)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel empty-state">No customers found.</div>
      )}
      <Pager page={currentPage} pages={pageCount} onPage={setPage} />
    </div>
  )
}
