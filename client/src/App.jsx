import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './context/AuthContext'
import BillForm from './pages/BillForm'
import Bills from './pages/Bills'
import CustomerLedger from './pages/CustomerLedger'
import Customers from './pages/Customers'
import Home from './pages/Home'
import Login from './pages/Login'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Users from './pages/Users'

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-label="Loading">
      <img className="loading-logo" src="/as-logo.png" alt="" />
    </div>
  )
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="bills" element={<Bills />} />
        <Route path="bills/new" element={<BillForm />} />
        <Route path="bills/:id" element={<BillForm />} />
        <Route path="customers" element={<Customers />} />
        <Route path="ledger" element={<CustomerLedger />} />
        <Route path="ledger/:customerId" element={<CustomerLedger />} />
        <Route path="reports" element={<Reports />} />
        <Route path="products" element={<Products />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
