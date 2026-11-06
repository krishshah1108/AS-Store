import { CaretRight, House } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router-dom'

const trails = [
  { test: (path) => path === '/bills', crumbs: [{ to: '/', label: 'Home' }, { label: 'Bills' }] },
  {
    test: (path) => path === '/bills/new',
    crumbs: [{ to: '/', label: 'Home' }, { to: '/bills', label: 'Bills' }, { label: 'Add bill' }],
  },
  {
    test: (path) => path.startsWith('/bills/'),
    crumbs: [{ to: '/', label: 'Home' }, { to: '/bills', label: 'Bills' }, { label: 'Bill' }],
  },
  { test: (path) => path === '/products', crumbs: [{ to: '/', label: 'Home' }, { label: 'Products' }] },
  {
    test: (path) => path === '/products/new',
    crumbs: [{ to: '/', label: 'Home' }, { to: '/products', label: 'Products' }, { label: 'Add product' }],
  },
  { test: (path) => path === '/customers', crumbs: [{ to: '/', label: 'Home' }, { label: 'Customers' }] },
  {
    test: (path) => path === '/customers/new',
    crumbs: [{ to: '/', label: 'Home' }, { to: '/customers', label: 'Customers' }, { label: 'Add customer' }],
  },
  { test: (path) => path === '/ledger', crumbs: [{ to: '/', label: 'Home' }, { label: 'Ledger' }] },
  {
    test: (path) => path.startsWith('/ledger/'),
    crumbs: [{ to: '/', label: 'Home' }, { to: '/ledger', label: 'Ledger' }, { label: 'Customer' }],
  },
  { test: (path) => path === '/reports', crumbs: [{ to: '/', label: 'Home' }, { label: 'Reports' }] },
  { test: (path) => path === '/users', crumbs: [{ to: '/', label: 'Home' }, { label: 'Users' }] },
  {
    test: (path) => path === '/users/new',
    crumbs: [{ to: '/', label: 'Home' }, { to: '/users', label: 'Users' }, { label: 'Add user' }],
  },
]

export default function Breadcrumbs({ className = '' }) {
  const { pathname } = useLocation()
  const trail = trails.find((item) => item.test(pathname))
  if (!trail) return null

  return (
    <nav className={`crumbs${className ? ` ${className}` : ''}`} aria-label="Breadcrumb">
      <ol>
        {trail.crumbs.map((crumb, index) => {
          const current = index === trail.crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`}>
              {current || !crumb.to ? (
                <span className="crumb-current" aria-current={current ? 'page' : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to}>
                  {index === 0 && <House size={14} weight="fill" aria-hidden="true" />}
                  {crumb.label}
                </Link>
              )}
              {!current && <CaretRight className="crumb-sep" size={12} weight="bold" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
