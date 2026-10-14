import { api, getStudentDbId } from './api'

export const attendanceService = {
  getAll: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    const response = await api.get(`/attendance?student_id=${studentId}`)
    const list = Array.isArray(response.data) ? response.data : (response || [])
    
    const records = []
    list.forEach(rec => {
      if (!rec.date) return
      
      const d = new Date(rec.date)
      const pad = (num) => String(num).padStart(2, '0')
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      
      const isAfternoon = String(rec.session).toUpperCase() === 'AFTERNOON'
      
      records.push({
        id: String(rec.id),
        date: dateStr,
        status: rec.status,
        session: isAfternoon ? 'Afternoon' : 'Forenoon'
      })
    })
    return records
  },

  getSummary: async () => {
    const records = await attendanceService.getAll()
    const total = records.length
    const present = records.filter(a => a.status === 'PRESENT').length
    const absent = total - present
    return {
      total,
      present,
      absent,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    }
  },
}
