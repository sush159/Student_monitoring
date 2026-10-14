/**
 * api.js — Base API client for Admin Frontend
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function request(method, path, data = null) {
  const token = localStorage.getItem('admin_token')
  const opts = {
    method,
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    credentials: 'include',
  }
  if (data) opts.body = JSON.stringify(data)

  const res = await fetch(`${BASE_URL}${path}`, opts)
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  patch: (path, data) => request('PATCH', path, data),
  delete: (path) => request('DELETE', path),
}
