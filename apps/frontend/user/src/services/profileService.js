import { api, getStudentDbId } from './api'

const normalize = (student) => {
  if (!student) return null
  return {
    id: student.student_id || student.register_number,
    name: student.name,
    registerNumber: student.register_number,
    email: student.email,
    phone: student.phone || '',
    github: student.github_url || '',
    department: 'Computer Science',
    year: '3rd Year',
    section: 'A'
  }
}

export const profileService = {
  get: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) {
      // Fall back to building profile from stored login data
      const storedUser = JSON.parse(localStorage.getItem('student_user') || '{}')
      return normalize({ 
        student_id: storedUser.id || '',
        register_number: storedUser.registerNumber || storedUser.student_id || '',
        name: storedUser.name || 'Student',
        email: storedUser.email || '',
        phone: storedUser.phone || '',
        github_url: storedUser.github_url || ''
      })
    }
    const response = await api.get(`/students/${studentId}`)
    return normalize(response.data || response)
  },

  update: async (updates) => {
    const studentId = await getStudentDbId()
    const payload = {
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      github_url: updates.github
    }
    const response = await api.put(`/students/${studentId}`, payload)
    const profile = normalize(response.data || response)
    
    const stored = JSON.parse(localStorage.getItem('student_user') || '{}')
    localStorage.setItem('student_user', JSON.stringify({ ...stored, ...profile }))
    return profile
  }
}
