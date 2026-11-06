import { Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import LogoLoader from '../components/LogoLoader'
import Pager from '../components/Pager'
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
      <Breadcrumbs />
      <header className="page-header">
        <div>
          <h1>Users</h1>
        </div>
        <Link to="/users/new" className="btn primary">
          <Plus size={16} weight="bold" />
          New user
        </Link>
      </header>

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
