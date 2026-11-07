import { useEffect, useState } from 'react'
import { billsApi, settingsApi } from '../lib/api'
import { useToast } from '../context/ToastContext'

export function billIsLocked(bill) {
  return bill?.status === 'cancelled' || bill?.status === 'returned'
}

export function billStatusLabel(bill) {
  if (!bill) return ''
  if (bill.status === 'returned') return 'Returned'
  if (bill.status === 'cancelled') return 'Cancelled'
  const due = Number(bill.dueAmount) || 0
  const paid = Number(bill.paidAmount) || 0
  if (due <= 0) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Unpaid'
}

export function billStatusTone(bill) {
  if (!bill) return 'muted'
  if (billIsLocked(bill)) return 'muted'
  const due = Number(bill.dueAmount) || 0
  const paid = Number(bill.paidAmount) || 0
  if (due <= 0) return 'paid'
  if (paid > 0) return 'partial'
  return 'due'
}

export default function useBill(id) {
  const toast = useToast()
  const [bill, setBill] = useState(null)
  const [settings, setSettings] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id || id === 'new') {
      setBill(null)
      setReady(true)
      return undefined
    }
    let active = true
    setReady(false)
    Promise.all([billsApi.get(id), settingsApi.get().catch(() => ({}))])
      .then(([nextBill, nextSettings]) => {
        if (!active) return
        setBill(nextBill)
        setSettings(nextSettings || {})
      })
      .catch((err) => {
        if (active) {
          setBill(null)
          toast.error(err.message)
        }
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [id, toast])

  return { bill, setBill, settings, ready }
}
