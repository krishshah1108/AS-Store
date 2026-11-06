import { LockKey, Phone, SignIn } from '@phosphor-icons/react'
import { useState } from 'react'
import Logo from '../components/Logo'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const signedIn = await login(mobile, password)
      toast.success(`Welcome back, ${signedIn?.name || 'there'}`)
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" method="post" onSubmit={onSubmit} autoComplete="on">
        <Logo />
        <p className="muted">Sign in with mobile number and password.</p>
        <label>
          <span className="label-with-icon">
            <Phone size={16} weight="duotone" /> Mobile
          </span>
          <input
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            minLength={10}
            maxLength={10}
            pattern="[0-9]{10}"
            title="Enter a 10-digit mobile number"
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
