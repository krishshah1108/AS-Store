import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('as_store_token')
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        localStorage.removeItem('as_store_token')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(mobile, password) {
    const res = await authApi.login(mobile, password)
    localStorage.setItem('as_store_token', res.token)
    setUser(res.user)
    return res.user
  }

  function logout() {
    localStorage.removeItem('as_store_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOwner: user?.role === 'owner' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
