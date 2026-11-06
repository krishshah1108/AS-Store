import { ArrowLeft, LockKey, Phone, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput'
import { usersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const emptyForm = { name: '', mobile: '', password: '', role: 'employee' }

export default function UserForm() {
  const { isOwner } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  if (!isOwner) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await usersApi.create(form)
      toast.success(created?.name ? `${created.name} added` : 'User created')
      navigate('/users')
    } catch (err) {
      toast.error(err.message || 'Could not create the user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/users" className="back-link">
            <ArrowLeft size={16} weight="bold" />
            All users
          </Link>
          <h1>Add user</h1>
          <p className="muted">Create an owner or an employee login.</p>
        </div>
      </header>

      <form className="panel form editor cols-2" onSubmit={onSubmit}>
        <label>
          Name *
          <input
            required
            placeholder="Staff name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          <span className="label-with-icon">
            <Phone size={16} weight="duotone" /> Mobile *
          </span>
          <input
            name="mobile"
            type="tel"
            required
            inputMode="numeric"
            autoComplete="tel"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={10}
            pattern="[0-9]{10}"
            title="Enter a 10-digit mobile number"
            placeholder="10-digit mobile number"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
          />
        </label>
        <label>
          Role *
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="employee">Employee</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label>
          <span className="label-with-icon">
            <LockKey size={16} weight="duotone" /> Password *
          </span>
          <PasswordInput
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={4}
            autoComplete="new-password"
            placeholder="Set a password"
          />
        </label>
        <div className="row-actions">
          <button className="btn primary" disabled={saving} type="submit">
            <Plus size={16} weight="bold" />
            {saving ? 'Creating…' : 'Create user'}
          </button>
          <Link className="btn ghost" to="/users">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
