import { ArrowLeft, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { productsApi } from '../lib/api'
import { cacheGet, cacheSet, enqueueMutation, newLocalId } from '../lib/storage'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', unit: 'pcs', salePrice: '' }

export default function ProductForm() {
  const navigate = useNavigate()
  const { online, refreshPending } = useSync()
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

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
      <header className="page-header">
        <div>
          <Link to="/products" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All products
          </Link>
          <h1>Add product</h1>
          <p className="muted">Add a name, unit, and sale price to the catalogue.</p>
        </div>
      </header>

      <form className="panel form editor" onSubmit={onSubmit}>
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
