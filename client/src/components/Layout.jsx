import {
  CalendarBlank,
  ChartLine,
  CloudArrowUp,
  House,
  List,
  Notebook,
  Package,
  Receipt,
  SignOut,
  Users as UsersIcon,
  UsersThree,
  WifiHigh,
  WifiSlash,
  X,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'

function greetingFor(name, compact) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const hello = compact ? part.charAt(0).toUpperCase() + part.slice(1) : `Good ${part}`
  const first = name?.trim().split(/\s+/)[0]
  return first ? `${hello}, ${first}` : hello
}

function todayLabel(compact) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: compact ? 'short' : 'long',
    day: 'numeric',
    month: compact ? 'short' : 'long',
    year: compact ? undefined : 'numeric',
  }).format(new Date())
}

const links = [
  { to: '/', label: 'Home', end: true, icon: House },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/ledger', label: 'Ledger', icon: Notebook },
  { to: '/reports', label: 'Reports', icon: ChartLine },
  { to: '/customers', label: 'Customers', icon: UsersThree },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/users', label: 'Users', ownerOnly: true, icon: UsersIcon },
]

export default function Layout() {
  const { user, logout, isOwner } = useAuth()
  const { online, pendingCount } = useSync()
  const toast = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  const location = useLocation()

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setConfirmLogout(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const connectionTitle = online ? 'Online' : 'Offline'

  function confirmSignOut() {
    toast.success('Signed out')
    setConfirmLogout(false)
    logout()
  }

  const navLinks = links.filter((l) => !l.ownerOnly || isOwner)

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation" inert={!isDesktop && !sidebarOpen ? true : undefined}>
        <div className="sidebar-brand">
          <Logo />
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((l) => {
            const Icon = l.icon
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Icon size={20} weight="regular" />
                {l.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="btn ghost logout-btn" onClick={() => setConfirmLogout(true)}>
            <SignOut size={16} weight="bold" />
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="content-shell">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <List size={24} weight="bold" />
          </button>
          <Logo />
          <div className="topbar-greeting">
            <p className="topbar-hello">
              <span className="hello-full">{greetingFor(user?.name)}</span>
              <span className="hello-short">{greetingFor(user?.name, true)}</span>
            </p>
            <p className="topbar-date">
              <CalendarBlank size={14} weight="bold" />
              <span className="date-full">{todayLabel()}</span>
              <span className="date-short">{todayLabel(true)}</span>
            </p>
          </div>
          <div className="profile-menu">
            <div className="profile-card">
              <span className="profile-avatar" aria-hidden="true">
                {(user?.name || 'U').slice(0, 1).toUpperCase()}
                <span className={`status-dot${online ? ' up' : ''}`} />
              </span>
              <span className="profile-copy">
                <strong>{user?.name}</strong>
                <small>
                  {online ? <WifiHigh size={14} weight="bold" /> : <WifiSlash size={14} weight="bold" />}
                  {connectionTitle}
                </small>
              </span>
            </div>
            {pendingCount > 0 && (
              <span className="pending-note" title={`${pendingCount} waiting to sync`}>
                <CloudArrowUp size={14} weight="bold" />
                {pendingCount}
              </span>
            )}
            <button type="button" className="btn ghost profile-logout" onClick={() => setConfirmLogout(true)}>
              <SignOut size={16} weight="bold" />
              Logout
            </button>
          </div>
        </header>

        <main className="main">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Primary">
          <NavLink to="/" end>
            <House size={22} weight="regular" />
            Home
          </NavLink>
          <NavLink to="/bills">
            <Receipt size={22} weight="regular" />
            Bills
          </NavLink>
          <NavLink to="/ledger">
            <Notebook size={22} weight="regular" />
            Ledger
          </NavLink>
          <NavLink to="/reports">
            <ChartLine size={22} weight="regular" />
            Reports
          </NavLink>
          <button type="button" onClick={() => setSidebarOpen(true)}>
            <List size={22} weight="regular" />
            Menu
          </button>
        </nav>
      </div>

      {confirmLogout && (
        <div className="modal-backdrop" onClick={() => setConfirmLogout(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="logout-title">Log out?</h2>
            <p className="muted">Sign in again with your mobile number and password.</p>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setConfirmLogout(false)}>
                Stay
              </button>
              <button type="button" className="btn primary" onClick={confirmSignOut}>
                <SignOut size={16} weight="bold" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
