export const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')

function withQuery(path, params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, value)
  })
  const qs = q.toString()
  return `${path}${qs ? `?${qs}` : ''}`
}

function authHeaders() {
  const token = localStorage.getItem('as_store_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }

  if (!res.ok) {
    const error = new Error(data?.message || 'Request failed')
    error.status = res.status
    throw error
  }
  return data
}

export const authApi = {
  login: (mobile, password) =>
    api('/api/auth/login', { method: 'POST', body: JSON.stringify({ mobile, password }) }),
  me: () => api('/api/auth/me'),
}

export const customersApi = {
  list: () => api('/api/customers?includeInactive=true'),
  create: (body) => api('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
}

export const productsApi = {
  list: () => api('/api/products?includeInactive=true'),
  create: (body) => api('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  import: (items) => api('/api/products/import', { method: 'POST', body: JSON.stringify({ items }) }),
}

export const usersApi = {
  list: () => api('/api/users'),
  create: (body) => api('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  setActive: (id, isActive) =>
    api(`/api/users/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
}

export const settingsApi = {
  get: () => api('/api/settings'),
  update: (body) => api('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
}

export const syncApi = {
  flush: (mutations) =>
    api('/api/sync/flush', { method: 'POST', body: JSON.stringify({ mutations }) }),
}

export const billsApi = {
  list: (params = {}) => api(withQuery('/api/bills', params)),
  get: (id) => api(`/api/bills/${id}`),
  create: (body) => api('/api/bills', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/bills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => api(`/api/bills/${id}`, { method: 'DELETE' }),
  returnItems: (id, body) =>
    api(`/api/bills/${id}/return`, { method: 'POST', body: JSON.stringify(body) }),
  activity: (id) => api(`/api/bills/${id}/activity`),
  payments: (id) => api(`/api/bills/${id}/payments`),
  receivePayment: (id, body) =>
    api(`/api/bills/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
}

export const ledgerApi = {
  list: (params = {}) => api(withQuery('/api/ledger', params)),
}

export const reportsApi = {
  dashboard: () => api('/api/reports/dashboard'),
  summary: (from, to) => api(withQuery('/api/reports/summary', { from, to })),
  customers: (from, to) => api(withQuery('/api/reports/customers', { from, to })),
}
