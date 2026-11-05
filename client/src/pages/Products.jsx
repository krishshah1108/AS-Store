import { FileXls, MagnifyingGlass, PencilSimple, Plus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LogoLoader from '../components/LogoLoader'
import Pager from '../components/Pager'
import ProductImport from '../components/ProductImport'
import StatusSwitch from '../components/StatusSwitch'
import { productsApi } from '../lib/api'
import { formatMoney } from '../lib/billShare'
import { cacheGet, cacheSet, enqueueMutation, newLocalId } from '../lib/storage'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', unit: 'pcs', salePrice: '' }

export default function Products() {
  const { refreshKey, online, refreshPending } = useSync()
  const toast = useToast()
  const [rows, setRows] = useState(() => cacheGet('products') || [])
  const [ready, setReady] = useState(() => (cacheGet('products') || []).length > 0)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  async function load() {
    try {
      const data = await productsApi.list()
      cacheSet('products', data)
      setRows(data)
    } catch {
      setRows(cacheGet('products') || [])
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
    return rows.filter((r) => r.name?.toLowerCase().includes(term))
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
    setImportOpen(false)
    setForm({
      name: row.name || '',
      unit: row.unit || 'pcs',
      salePrice: String(row.salePrice ?? ''),
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
      name: form.name,
      unit: form.unit || 'pcs',
      salePrice: Number(form.salePrice) || 0,
      updatedAtClient: new Date().toISOString(),
    }

    try {
      if (!online) {
        const next = rows.map((r) =>
          r._id === editing._id ? { ...r, ...payload, _pending: true } : r
        )
        setRows(next)
        cacheSet('products', next)
        enqueueMutation({
          id: newLocalId(),
          entity: 'product',
          op: 'update',
          payload: { ...payload, _id: editing._id },
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        resetForm()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        await productsApi.update(editing._id, payload)
        resetForm()
        await load()
        toast.success('Product updated')
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
      unit: row.unit,
      salePrice: row.salePrice,
      isActive,
      updatedAtClient: new Date().toISOString(),
    }
    try {
      if (!online) {
        const next = rows.map((r) => (r._id === row._id ? { ...r, ...payload, _pending: true } : r))
        setRows(next)
        cacheSet('products', next)
        enqueueMutation({
          id: newLocalId(),
          entity: 'product',
          op: 'update',
          payload: { ...payload, _id: row._id },
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        setRows((list) => list.map((item) => (item._id === row._id ? { ...item, isActive } : item)))
        await productsApi.update(row._id, payload)
        toast.success(isActive ? 'Product activated' : 'Product deactivated')
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
      <header className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted">Catalogue with searchable names and editable rates.</p>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setImportOpen(true)
              setFormOpen(false)
            }}
          >
            <FileXls size={16} weight="bold" />
            Import Excel
          </button>
          <Link to="/products/new" className="btn primary">
            <Plus size={16} weight="bold" />
            Add product
          </Link>
        </div>
      </header>

      {importOpen && (
        <ProductImport
          existingNames={rows.map((row) => row.name || '')}
          online={online}
          onDone={() => {
            setImportOpen(false)
            load()
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {formOpen && (
        <form className="panel form editor" onSubmit={onSubmit}>
          <h2>Edit product</h2>
          <label>
            Name *
            <input
              required
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Unit
            <input
              placeholder="pcs, kg, box…"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </label>
          <label>
            Sale price (₹) *
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
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
            placeholder="Search products…"
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
                  <span className="muted">{row.unit || 'pcs'}</span>
                </div>
              </div>
              <dl className="record-facts">
                <div>
                  <dt>Price</dt>
                  <dd>{formatMoney(row.salePrice)}</dd>
                </div>
              </dl>
              <div className="row-actions">
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
        <div className="panel empty-state">No products found.</div>
      )}
      <Pager page={currentPage} pages={pageCount} onPage={setPage} />
    </div>
  )
}
