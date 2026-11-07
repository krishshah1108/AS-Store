import { ArrowLeft, FileXls, Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import ProductImport from '../components/ProductImport'
import { productsApi } from '../lib/api'
import { cacheGet, cacheSet, enqueueMutation, newLocalId } from '../lib/storage'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', salePrice: '' }

export default function ProductForm() {
  const navigate = useNavigate()
  const { online, refreshPending } = useSync()
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [existingNames, setExistingNames] = useState(() =>
    (cacheGet('products') || []).map((row) => row.name || '')
  )

  useEffect(() => {
    if (!online) return undefined
    let active = true
    productsApi
      .list()
      .then((rows) => {
        if (!active) return
        cacheSet('products', rows)
        setExistingNames(rows.map((row) => row.name || ''))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [online])

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      salePrice: form.salePrice,
      updatedAtClient: new Date().toISOString(),
    }

    try {
      if (!online) {
        const rows = cacheGet('products') || []
        const local = { _id: newLocalId(), ...payload, isActive: true, _pending: true }
        cacheSet('products', [...rows, local])
        enqueueMutation({
          id: local._id,
          entity: 'product',
          op: 'create',
          payload: local,
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        await productsApi.create(payload)
        toast.success('Product added')
      }
      navigate('/products')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <Link to="/products" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All products
          </Link>
          <h1>Add product</h1>
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost is-import" onClick={() => setImportOpen((open) => !open)}>
            <FileXls size={16} weight="bold" />
            Import products
          </button>
        </div>
      </header>

      {importOpen && (
        <ProductImport
          existingNames={existingNames}
          online={online}
          onDone={() => navigate('/products')}
          onClose={() => setImportOpen(false)}
        />
      )}

      <form className="panel form editor cols-2" onSubmit={onSubmit}>
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
            <Plus size={16} weight="bold" />
            {saving ? 'Saving…' : 'Add'}
          </button>
          <Link className="btn ghost" to="/products">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
