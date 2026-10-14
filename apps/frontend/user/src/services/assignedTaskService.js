import { api, getStudentDbId } from './api'

const formatAdminName = (email) => {
  if (!email) return 'Admin'
  if (email.includes('@')) {
    const part = email.split('@')[0]
    return part.charAt(0).toUpperCase() + part.slice(1)
  }
  return email
}

const normalizeTask = (t) => {
  if (!t) return null
  return {
    id: String(t.id),
    title: t.title,
    assignedBy: formatAdminName(t.assigned_by) || 'Admin',
    dueDate: t.due_date ? t.due_date.split('T')[0] : '',
    status: t.status || 'PENDING'
  }
}

export const assignedTaskService = {
  getAll: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    try {
      const response = await api.get(`/assigned-tasks?student_id=${studentId}`)
      const list = Array.isArray(response.data) ? response.data : (response || [])
      return list.map(normalizeTask)
    } catch (e) {
      console.error('Failed to fetch assigned tasks', e)
      return []
    }
  },
  
  getPending: async () => {
    const list = await assignedTaskService.getAll()
    return list.filter(t => t.status === 'PENDING')
  },

  markCompleted: async (id) => {
    try {
      const response = await api.put(`/assigned-tasks/${id}`, { status: 'COMPLETED' })
      const updated = response.data || response
      return normalizeTask(updated)
    } catch (e) {
      console.error('Failed to complete task', e)
      throw e
    }
  }
}
