import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ICONS = { success: CheckCircle, error: WarningCircle, info: Info }

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (message, tone) => {
      const text = String(message || '').trim()
      if (!text) return
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setToasts((list) => [...list.slice(-4), { id, message: text, tone }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss]
  )

  const toast = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => {
          const Icon = ICONS[item.tone] || Info
          return (
            <button
              key={item.id}
              type="button"
              className={`toast ${item.tone}`}
              onClick={() => dismiss(item.id)}
            >
              <Icon size={18} weight="fill" />
              <span>{item.message}</span>
            </button>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within ToastProvider')
  return toast
}
