import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../lib/api'

const AuthContext = createContext(null)
const TOKEN_KEY = 'as_store_token'
const USER_KEY = 'as_store_user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return null
    return readStoredUser()
  })
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY) && !readStoredUser()))

  useEffect(() => {
    function onUnauthorized() {
      clearSession()
      setUser(null)
      setLoading(false)
    }
    window.addEventListener('as-store:unauthorized', onUnauthorized)
    return () => window.removeEventListener('as-store:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then((res) => {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        setUser(res.user)
      })
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          clearSession()
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(mobile, password) {
    const res = await authApi.login(mobile, password)
    saveSession(res.token, res.user)
    setUser(res.user)
    return res.user
  }

  function logout() {
    clearSession()
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
