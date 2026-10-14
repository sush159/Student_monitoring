/**
 * api.js — Base API client (swap mock → real REST endpoints here)
 * All service files import this and call request().
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function request(method, path, data = null) {
  const token = localStorage.getItem('student_token')
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
      localStorage.removeItem('student_token')
      localStorage.removeItem('student_user')
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

export async function getStudentDbId() {
  const storedUser = JSON.parse(localStorage.getItem('student_user') || '{}')
  
  // 1. First: use student_db_id if already cached (from a previous lookup)
  if (storedUser.student_db_id) {
    return storedUser.student_db_id
  }

  // 2. Second: use student_id directly from the login response
  //    The login API stores the students table row ID as student_id
  if (storedUser.student_id) {
    return String(storedUser.student_id)
  }
  
  // 3. Third: fall back to looking up by email from /api/students
  try {
    const email = storedUser.email
    if (email) {
      const response = await request('GET', '/students')
      const list = Array.isArray(response.data) ? response.data : (response || [])
      const matched = list.find(s => s.email.toLowerCase() === email.toLowerCase())
      if (matched) {
        storedUser.student_db_id = String(matched.id)
        storedUser.registerNumber = matched.register_number
        localStorage.setItem('student_user', JSON.stringify(storedUser))
        return String(matched.id)
      }
    }
  } catch (e) {
    console.error('Failed to resolve student DB ID', e)
  }

  // No valid student ID found — return null so callers can handle gracefully
  console.warn('Could not determine student DB ID. User may not be logged in correctly.')
  return null
}
