import { LockKey, Phone, SignIn } from '@phosphor-icons/react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Logo from '../components/Logo'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { user, login, loading } = useAuth()
  const toast = useToast()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const signedIn = await login(mobile.trim(), password)
      toast.success(`Welcome back, ${signedIn?.name || 'there'}`)
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit} autoComplete="on">
        <Logo />
        <p className="muted">Sign in with mobile number and password.</p>
        <label>
          <span className="label-with-icon">
            <Phone size={16} weight="duotone" /> Mobile
          </span>
          <input
            name="username"
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            required
            minLength={10}
            maxLength={15}
            pattern="[0-9]{10,15}"
            title="Enter your mobile number"
            placeholder="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label>
          <span className="label-with-icon">
            <LockKey size={16} weight="duotone" /> Password
          </span>
          <PasswordInput
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Password"
          />
        </label>
        <button className="btn primary" disabled={submitting} type="submit">
          <SignIn size={18} weight="bold" />
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
