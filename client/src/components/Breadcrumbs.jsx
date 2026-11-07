import { CaretRight, House } from '@phosphor-icons/react'
import { Link, useLocation, useParams } from 'react-router-dom'

function billCrumbs(pathname, params, billNo) {
  const label = billNo || 'Bill'
  const base = [
    { to: '/', label: 'Home' },
    { to: '/bills', label: 'Bills' },
    { to: `/bills/${params.id}`, label },
  ]
  if (pathname.endsWith('/edit')) return [...base, { label: 'Edit' }]
  if (pathname.endsWith('/payment')) return [...base, { label: 'Payment' }]
  if (pathname.endsWith('/return')) return [...base, { label: 'Return' }]
  return base
}

const trails = [
  { test: (path) => path === '/bills', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Bills' }] },
  {
    test: (path) => path === '/bills/new',
    crumbs: () => [{ to: '/', label: 'Home' }, { to: '/bills', label: 'Bills' }, { label: 'Add bill' }],
  },
  {
    test: (path) => path.startsWith('/bills/'),
    crumbs: (path, params, billNo) => billCrumbs(path, params, billNo),
  },
  { test: (path) => path === '/products', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Products' }] },
  {
    test: (path) => path === '/products/new',
    crumbs: () => [{ to: '/', label: 'Home' }, { to: '/products', label: 'Products' }, { label: 'Add product' }],
  },
  { test: (path) => path === '/customers', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Customers' }] },
  {
    test: (path) => path === '/customers/new',
    crumbs: () => [{ to: '/', label: 'Home' }, { to: '/customers', label: 'Customers' }, { label: 'Add customer' }],
  },
  { test: (path) => path === '/ledger', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Ledger' }] },
  {
    test: (path) => path.startsWith('/ledger/'),
    crumbs: () => [{ to: '/', label: 'Home' }, { to: '/ledger', label: 'Ledger' }, { label: 'Customer' }],
  },
  { test: (path) => path === '/reports', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Reports' }] },
  { test: (path) => path === '/users', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Users' }] },
  { test: (path) => path === '/settings', crumbs: () => [{ to: '/', label: 'Home' }, { label: 'Settings' }] },
  {
    test: (path) => path === '/users/new',
    crumbs: () => [{ to: '/', label: 'Home' }, { to: '/users', label: 'Users' }, { label: 'Add user' }],
  },
]

export default function Breadcrumbs({ className = '', billNo }) {
  const { pathname } = useLocation()
  const params = useParams()
  const trail = trails.find((item) => item.test(pathname))
  if (!trail) return null
  const crumbs = trail.crumbs(pathname, params, billNo)

  return (
    <nav className={`crumbs${className ? ` ${className}` : ''}`} aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1
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
