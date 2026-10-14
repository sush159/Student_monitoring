import { api, getStudentDbId } from './api'

const normalize = (leave) => {
  if (!leave) return null
  return {
    id: String(leave.id),
    startDate: leave.start_date ? leave.start_date.split('T')[0] : '',
    endDate: leave.end_date ? leave.end_date.split('T')[0] : '',
    fromTime: leave.start_time || '',
    toTime: leave.end_time || '',
    reason: leave.reason,
    submittedOn: leave.created_at ? leave.created_at.split('T')[0] : '',
    status: leave.status || 'PENDING'
  }
}

export const leaveService = {
  getAll: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    const response = await api.get(`/leave?student_id=${studentId}`)
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalize).sort((a, b) => b.submittedOn.localeCompare(a.submittedOn))
  },

  apply: async ({ startDate, endDate, fromTime, toTime, reason }) => {
    const student_id = await getStudentDbId()
    const payload = {
      student_id,
      start_date: startDate,
      end_date: endDate,
      start_time: fromTime,
      end_time: toTime,
      reason
    }
    const response = await api.post('/leave', payload)
    return normalize(response.data)
  },
}
