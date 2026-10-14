import { api } from './api'

let currentUser = null

export const authService = {
  login: async (email, password) => {
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    const response = await api.post('/auth/login', { email, password })
    const { token, user } = response.data
    currentUser = user
    localStorage.setItem('student_token', token)
    localStorage.setItem('student_user', JSON.stringify(user))
    return user
  },

  logout: () => {
    currentUser = null
    localStorage.removeItem('student_token')
    localStorage.removeItem('student_user')
  },

  getCurrentUser: () => {
    const token = localStorage.getItem('student_token')
    if (!token) {
      currentUser = null
      return null
    }
    if (currentUser) return currentUser
    const stored = localStorage.getItem('student_user')
    if (stored) {
      try {
        currentUser = JSON.parse(stored)
        return currentUser
      } catch {
        return null
      }
    }
    return null
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('student_token')
  },
}
