import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL, syncApi } from '../lib/api'
import { clearOutboxIds, getOutbox } from '../lib/storage'
import { useAuth } from './AuthContext'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { user } = useAuth()
  const [networkUp, setNetworkUp] = useState(navigator.onLine)
  const [backendUp, setBackendUp] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => getOutbox().length)
  const [refreshKey, setRefreshKey] = useState(0)

  const online = networkUp && backendUp

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  const refreshPending = useCallback(() => {
    setPendingCount(getOutbox().length)
  }, [])

  const checkBackend = useCallback(async () => {
    if (!navigator.onLine) {
      setBackendUp(false)
      return false
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    try {
      const res = await fetch(`${API_URL}/api/health`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      const ok = res.ok
      setBackendUp(ok)
      return ok
    } catch {
      setBackendUp(false)
      return false
    } finally {
      clearTimeout(timer)
    }
  }, [])

  const flushOutbox = useCallback(async () => {
    const mutations = getOutbox()
    if (!mutations.length || !navigator.onLine) {
      refreshPending()
      return
    }
    const backendOk = await checkBackend()
    if (!backendOk) {
      refreshPending()
      return
    }
    try {
      const { results } = await syncApi.flush(mutations)
      const done = results.filter((r) => r.ok).map((r) => r.id)
      clearOutboxIds(done)
      refreshPending()
      bump()
    } catch (err) {
      console.warn('Sync flush failed', err)
      setBackendUp(false)
    }
  }, [bump, checkBackend, refreshPending])

  useEffect(() => {
    function onOnline() {
      setNetworkUp(true)
      checkBackend().then((ok) => {
        if (ok) flushOutbox()
      })
    }
    function onOffline() {
      setNetworkUp(false)
      setBackendUp(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    checkBackend()
    const poll = setInterval(checkBackend, 12000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(poll)
    }
  }, [checkBackend, flushOutbox])

  useEffect(() => {
    if (!user) return undefined

    const socket = io(API_URL || undefined, {
      path: '/socket.io',
      transports: ['polling'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 8,
      timeout: 12000,
    })

    const onChange = () => {
      bump()
    }

    socket.on('connect', () => {
      if (navigator.onLine) setBackendUp(true)
    })
    socket.on('disconnect', () => {
      checkBackend()
    })
    socket.on('connect_error', () => {
      checkBackend()
    })

    socket.on('data:changed', onChange)

    flushOutbox()

    return () => {
      socket.disconnect()
    }
  }, [user, bump, flushOutbox, checkBackend])

  return (
    <SyncContext.Provider
      value={{
        online,
        pendingCount,
        refreshKey,
        refreshPending,
        bump,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  return useContext(SyncContext)
}
