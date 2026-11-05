const OUTBOX_KEY = 'as_store_outbox'
const CACHE_PREFIX = 'as_store_cache_'

export function getOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]')
  } catch {
    return []
  }
}

function setOutbox(items) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items))
}

export function enqueueMutation(mutation) {
  const items = getOutbox()
  items.push(mutation)
  setOutbox(items)
  return mutation
}

export function clearOutboxIds(ids) {
  const set = new Set(ids)
  setOutbox(getOutbox().filter((m) => !set.has(m.id)))
}

export function cacheSet(key, data) {
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data }))
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw).data
  } catch {
    return null
  }
}

export function newLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
