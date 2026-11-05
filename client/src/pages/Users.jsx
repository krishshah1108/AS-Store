import { LockKey, Phone, Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import LogoLoader from '../components/LogoLoader'
import Pager from '../components/Pager'
import PasswordInput from '../components/PasswordInput'
import StatusSwitch from '../components/StatusSwitch'
import { usersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

export default function Users() {
  const { isOwner } = useAuth()
  const { refreshKey } = useSync()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', password: '', role: 'employee' })
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isOwner) return undefined
    let active = true
    usersApi
      .list()
      .then((data) => {
        if (active) setRows(data)
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
  }, [refreshKey, isOwner, toast])

  if (!isOwner) return <Navigate to="/" replace />
  if (!ready) return <LogoLoader page />

  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  async function load() {
    const data = await usersApi.list()
    setRows(data)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await usersApi.create(form)
      const name = created?.name || form.name
      toast.success(name ? `${name} added` : 'User created')
      setForm({ name: '', mobile: '', password: '', role: 'employee' })
      setFormOpen(false)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(row, isActive) {
    setRows((list) => list.map((item) => (item._id === row._id ? { ...item, isActive } : item)))
    try {
      await usersApi.setActive(row._id, isActive)
      toast.success(isActive ? 'User activated' : 'User deactivated')
    } catch (err) {
      setRows((list) => list.map((item) => (item._id === row._id ? { ...item, isActive: row.isActive } : item)))
      toast.error(err.message)
    }
  }

  function roleLabel(role) {
    return role === 'owner' ? 'Owner' : 'Employee'
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="muted">Add an owner or an employee, then turn access on or off.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} weight="bold" />
          New user
        </button>
      </header>

      {formOpen && (
        <form className="panel form editor" onSubmit={onSubmit}>
          <h2>Add user</h2>
          <label>
            Name
            <input
              required
              placeholder="Staff name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span className="label-with-icon">
              <Phone size={16} weight="duotone" /> Mobile
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
              placeholder="10-digit mobile number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="employee">Employee</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label>
            <span className="label-with-icon">
              <LockKey size={16} weight="duotone" /> Password
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
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setFormOpen(false)
                setForm({ name: '', mobile: '', password: '', role: 'employee' })
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {rows.length ? (
        <ul className="record-list">
          {visible.map((row) => (
            <li className={`record ${row.isActive ? 'is-active' : 'is-inactive'}`} key={row._id}>
              <div className="record-top">
                <div className="record-title">
                  <strong>{row.name}</strong>
                  <span className="muted">{row.mobile}</span>
                </div>
              </div>
              <dl className="record-facts">
                <div>
                  <dt>Role</dt>
                  <dd>{roleLabel(row.role)}</dd>
                </div>
              </dl>
              <div className="row-actions">
                <StatusSwitch
                  checked={row.isActive !== false}
                  label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
                  onChange={(isActive) => toggle(row, isActive)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel empty-state">No users yet.</div>
      )}
      <Pager page={currentPage} pages={pageCount} onPage={setPage} />
    </div>
  )
}
