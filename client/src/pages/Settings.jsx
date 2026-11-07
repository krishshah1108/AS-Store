import { FloppyDisk } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import { settingsApi } from '../lib/api'
import { useToast } from '../context/ToastContext'

const emptyForm = {
  shopName: '',
  address: '',
  phone: '',
  upiId: '',
  overdueDays: '30',
  billFooterNote: '',
}

export default function Settings() {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    settingsApi
      .get()
      .then((settings) => {
        if (!active) return
        setForm({
          shopName: settings.shopName || '',
          address: settings.address || '',
          phone: settings.phone || '',
          upiId: settings.upiId || '',
          overdueDays: String(settings.overdueDays ?? 30),
          billFooterNote: settings.billFooterNote || '',
        })
      })
      .catch((err) => {
        if (active) toast.error(err.message)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [toast])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await settingsApi.update({
        ...form,
        shopName: form.shopName.trim(),
        phone: form.phone.trim(),
        overdueDays: Number(form.overdueDays),
      })
      setForm({
        shopName: saved.shopName || '',
        address: saved.address || '',
        phone: saved.phone || '',
        upiId: saved.upiId || '',
        overdueDays: String(saved.overdueDays ?? 30),
        billFooterNote: saved.billFooterNote || '',
      })
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return <LogoLoader page />

  return (
    <div className="page">
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <h1>Settings</h1>
        </div>
      </header>

      <form className="panel form editor cols-2" onSubmit={onSubmit}>
        <label>
          Shop name *
          <input
            required
            value={form.shopName}
            onChange={(event) => update('shopName', event.target.value)}
          />
        </label>
        <label>
          Phone
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number, or leave it blank"
            placeholder="10-digit phone number"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label>
          Address
          <input
            placeholder="Shop address"
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
          />
        </label>
        <label>
          UPI
          <input
            placeholder="name@upi"
            value={form.upiId}
            onChange={(event) => update('upiId', event.target.value)}
          />
        </label>
        <label>
          Overdue after (days) *
          <input
            required
            type="number"
            min="1"
            step="1"
            value={form.overdueDays}
            onChange={(event) => update('overdueDays', event.target.value)}
          />
        </label>
        <label>
          Bill note
          <input
            placeholder="Thank you for your business"
            value={form.billFooterNote}
            onChange={(event) => update('billFooterNote', event.target.value)}
          />
        </label>
        <div className="row-actions">
          <button className="btn primary" disabled={saving} type="submit">
            <FloppyDisk size={16} weight="bold" />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
