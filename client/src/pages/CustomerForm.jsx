import { ArrowLeft, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { customersApi } from '../lib/api'
import { cacheGet, cacheSet, enqueueMutation, newLocalId } from '../lib/storage'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', mobile: '', address: '', notes: '' }

export default function CustomerForm() {
  const navigate = useNavigate()
  const { online, refreshPending } = useSync()
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

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
        const rows = cacheGet('customers') || []
        const local = {
          _id: newLocalId(),
          ...payload,
          isActive: true,
          balance: 0,
          _pending: true,
        }
        cacheSet('customers', [...rows, local])
        enqueueMutation({
          id: local._id,
          entity: 'customer',
          op: 'create',
          payload: local,
          clientUpdatedAt: payload.updatedAtClient,
        })
        refreshPending()
        toast.info('Saved on this device. It will sync when you are back online.')
      } else {
        await customersApi.create(payload)
        toast.success('Customer added')
      }
      navigate('/customers')
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
          <Link to="/customers" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All customers
          </Link>
          <h1>Add customer</h1>
          <p className="muted">Add a customer name, mobile, and address.</p>
        </div>
      </header>

      <form className="panel form editor cols-2" onSubmit={onSubmit}>
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
            <Plus size={16} weight="bold" />
            {saving ? 'Saving…' : 'Add'}
          </button>
          <Link className="btn ghost" to="/customers">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
