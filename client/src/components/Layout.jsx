import {
  CalendarBlank,
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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  {
    to: '/bills',
    label: 'Bills',
    icon: Receipt,
    match: (path) => path === '/bills' || (path.startsWith('/bills/') && path !== '/bills/new'),
    children: [{ to: '/bills/new', label: 'Add bill', icon: Plus, accent: true }],
  },
  { to: '/ledger', label: 'Ledger', icon: Notebook },
  { to: '/reports', label: 'Reports', icon: ChartLine },
  {
    to: '/customers',
    label: 'Customers',
    end: true,
    icon: UsersThree,
    children: [{ to: '/customers/new', label: 'Add customer', icon: Plus }],
  },
  {
    to: '/products',
    label: 'Products',
    end: true,
    icon: Package,
    children: [{ to: '/products/new', label: 'Add product', icon: Plus }],
  },
  {
    to: '/users',
    label: 'Users',
    end: true,
    ownerOnly: true,
    icon: UsersIcon,
    children: [{ to: '/users/new', label: 'Add user', icon: Plus }],
  },
]

function barItem(items, to) {
  for (const item of items) {
    if (item.to === to) return item
    const child = item.children?.find((entry) => entry.to === to)
    if (child) return child
  }
  return null
}

function pathInGroup(item, pathname) {
  if (item.match ? item.match(pathname) : pathname === item.to) return true
  return (item.children || []).some((child) => pathname === child.to)
}

function NavGroup({ item, pathname }) {
  const current = pathInGroup(item, pathname)
  return (
    <div className={`nav-group${current ? ' is-open' : ''}`}>
      <NavItem item={item} pathname={pathname} />
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
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
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
    setProfileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setConfirmLogout(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!profileOpen) return undefined
    function onPointer(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [profileOpen])

  const connectionTitle = online ? 'Online' : 'Offline'

  function confirmSignOut() {
    toast.success('Signed out')
    setConfirmLogout(false)
    logout()
  }

  const navLinks = links.filter((l) => !l.ownerOnly || isOwner)
  const mobileBar = ['/', '/products', '/bills/new', '/ledger', '/reports'].map((to) => barItem(navLinks, to))

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
          {navLinks.map((l) =>
            isDesktop && l.children?.length ? (
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
          <div className="profile-menu" ref={profileRef}>
            {isDesktop ? (
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
            ) : (
              <button
                type="button"
                className="profile-card"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
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
              </button>
            )}
            {!isDesktop && profileOpen && (
              <div className="profile-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="btn ghost"
                  onClick={() => {
                    setProfileOpen(false)
                    setConfirmLogout(true)
                  }}
                >
                  <SignOut size={16} weight="bold" />
                  Logout
                </button>
              </div>
            )}
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
