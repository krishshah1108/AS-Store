import {
  CalendarBlank,
  CaretRight,
  ChartLine,
  CloudArrowUp,
  House,
  List,
  Notebook,
  Package,
  Plus,
  Receipt,
  SignOut,
  Users as UsersIcon,
  UsersThree,
  WifiHigh,
  WifiSlash,
  X,
} from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useState } from 'react'
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
  { to: '/', label: 'Home', end: true, icon: House, mobile: 'bar' },
  {
    to: '/bills',
    label: 'Bills',
    icon: Receipt,
    mobile: 'bar',
    match: (path) => path === '/bills' || (path.startsWith('/bills/') && path !== '/bills/new'),
    children: [{ to: '/bills/new', label: 'Add bill', icon: Plus, mobile: 'bar', accent: true }],
  },
  { to: '/ledger', label: 'Ledger', icon: Notebook, mobile: 'bar' },
  { to: '/reports', label: 'Reports', icon: ChartLine, mobile: 'bar' },
  {
    to: '/customers',
    label: 'Customers',
    end: true,
    icon: UsersThree,
    mobile: 'menu',
    children: [{ to: '/customers/new', label: 'Add customer', icon: Plus }],
  },
  {
    to: '/products',
    label: 'Products',
    end: true,
    icon: Package,
    mobile: 'menu',
    children: [{ to: '/products/new', label: 'Add product', icon: Plus }],
  },
  { to: '/users', label: 'Users', ownerOnly: true, icon: UsersIcon, mobile: 'menu' },
]

function barLinks(items) {
  const out = []
  for (const item of items) {
    if (item.mobile === 'bar') out.push(item)
    for (const child of item.children || []) {
      if (child.mobile === 'bar') out.push(child)
    }
  }
  return out
}

function pathInGroup(item, pathname) {
  if (pathname === item.to || item.match?.(pathname)) return true
  return (item.children || []).some((child) => pathname === child.to || child.match?.(pathname))
}

function NavGroup({ item, pathname }) {
  const [open, setOpen] = useState(() => pathInGroup(item, pathname))

  useEffect(() => {
    setOpen(pathInGroup(item, pathname))
  }, [item, pathname])

  return (
    <div className={`nav-group${open ? ' is-open' : ''}`}>
      <div className="nav-parent">
        <NavItem item={item} pathname={pathname} />
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-label={open ? `Hide ${item.label} pages` : `Show ${item.label} pages`}
          onClick={() => setOpen((value) => !value)}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className="nav-children">
        {item.children.map((child) => (
          <NavItem key={child.to} item={child} pathname={pathname} />
        ))}
      </div>
    </div>
  )
}

function NavItem({ item, pathname, compact }) {
  const Icon = item.icon
  const active = (isActive) => (item.match ? item.match(pathname) : isActive) ? 'active' : ''
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => [active(isActive), compact && item.accent ? 'bottom-add' : ''].filter(Boolean).join(' ')}
    >
      <Icon size={compact ? 22 : 20} weight={item.accent ? 'bold' : 'regular'} />
      {compact ? <span>{item.label}</span> : item.label}
    </NavLink>
  )
}

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

  useLayoutEffect(() => {
    setSidebarOpen(false)
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
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
  const menuLinks = isDesktop ? navLinks : navLinks.filter((l) => l.mobile === 'menu')
  const mobileBar = barLinks(navLinks)

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
          {menuLinks.map((l) =>
            l.children?.length ? (
              <NavGroup key={l.to} item={l} pathname={location.pathname} />
            ) : (
              <div className="nav-group" key={l.to}>
                <NavItem item={l} pathname={location.pathname} />
              </div>
            )
          )}
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

        <nav className="bottom-nav" aria-label="Primary" style={{ '--bottom-count': mobileBar.length }}>
          {mobileBar.map((item) => (
            <NavItem key={item.to} item={item} pathname={location.pathname} compact />
          ))}
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
