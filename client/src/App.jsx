import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LogoLoader from './components/LogoLoader'
import { useAuth } from './context/AuthContext'
import BillForm from './pages/BillForm'
import BillPayment from './pages/BillPayment'
import BillReturn from './pages/BillReturn'
import BillView from './pages/BillView'
import Bills from './pages/Bills'
import CustomerLedger from './pages/CustomerLedger'
import CustomerForm from './pages/CustomerForm'
import Customers from './pages/Customers'
import Home from './pages/Home'
import Login from './pages/Login'
import ProductForm from './pages/ProductForm'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import UserForm from './pages/UserForm'
import Users from './pages/Users'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <LogoLoader />
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="bills" element={<Bills />} />
        <Route path="bills/new" element={<BillForm />} />
        <Route path="bills/:id" element={<BillView />} />
        <Route path="bills/:id/edit" element={<BillForm />} />
        <Route path="bills/:id/payment" element={<BillPayment />} />
        <Route path="bills/:id/return" element={<BillReturn />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="ledger" element={<CustomerLedger />} />
        <Route path="ledger/:customerId" element={<CustomerLedger />} />
        <Route path="reports" element={<Reports />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="users" element={<Users />} />
        <Route path="users/new" element={<UserForm />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
