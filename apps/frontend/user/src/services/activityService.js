import { api, getStudentDbId } from './api'
import { format } from 'date-fns'

const normalize = (activity) => {
  if (!activity) return null
  
  const d = new Date(activity.start_time)
  const pad = (num) => String(num).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const startTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  
  const dEnd = new Date(activity.end_time)
  const endTime = `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}`
  
  let extendedEndTime = null
  if (activity.extended_until) {
    const dExt = new Date(activity.extended_until)
    extendedEndTime = `${pad(dExt.getHours())}:${pad(dExt.getMinutes())}`
  }

  let desc = activity.description || ''
  let extensionReason = null
  if (desc.startsWith('Extension Note: ')) {
    extensionReason = desc.substring('Extension Note: '.length)
  }

  return {
    id: String(activity.id),
    name: activity.activity_name,
    description: desc,
    date,
    startTime,
    endTime,
    progress: activity.progress || 0,
    status: activity.status || 'PLANNED',
    extendedEndTime,
    extensionReason
  }
}

export const activityService = {
  getAll: async () => {
    const response = await api.get('/activities')
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalize)
  },

  getByDate: async (dateStr) => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    const response = await api.get(`/activities?date=${dateStr}&student_id=${studentId}`)
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalize)
  },

  getByDateRange: async (startDate, endDate) => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    const response = await api.get(`/activities?start_date=${startDate}&end_date=${endDate}&student_id=${studentId}`)
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalize)
  },

  create: async (data) => {
    const [year, month, day] = data.date.split('-').map(Number)
    const [startH, startM] = data.startTime.split(':').map(Number)
    const [endH, endM] = data.endTime.split(':').map(Number)
    
    const start_time = new Date(year, month - 1, day, startH, startM, 0).toISOString()
    const end_time = new Date(year, month - 1, day, endH, endM, 0).toISOString()
    
    const student_id = await getStudentDbId()
    
    const payload = {
      student_id,
      activity_name: data.name,
      description: data.description || '',
      start_time,
      end_time,
      status: data.status || 'PLANNED',
      progress: data.progress || 0
    }
    
    const response = await api.post('/activities', payload)
    return normalize(response.data)
  },

  update: async (id, updates) => {
    const payload = {}
    if (updates.name !== undefined) payload.activity_name = updates.name
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.progress !== undefined) payload.progress = updates.progress
    if (updates.status !== undefined) payload.status = updates.status
    
    if (updates.date && updates.startTime) {
      const [year, month, day] = updates.date.split('-').map(Number)
      const [startH, startM] = updates.startTime.split(':').map(Number)
      payload.start_time = new Date(year, month - 1, day, startH, startM, 0).toISOString()
    }
    if (updates.date && updates.endTime) {
      const [year, month, day] = updates.date.split('-').map(Number)
      const [endH, endM] = updates.endTime.split(':').map(Number)
      payload.end_time = new Date(year, month - 1, day, endH, endM, 0).toISOString()
    }

    const response = await api.put(`/activities/${id}`, payload)
    return normalize(response.data)
  },

  extendTime: async (id, extendedEndTime, reason) => {
    const response = await api.get(`/activities/${id}`)
    const activity = response.data
    
    const origEndTime = new Date(activity.end_time)
    const [hours, minutes] = extendedEndTime.split(':').map(Number)
    const newEndTime = new Date(origEndTime)
    newEndTime.setHours(hours, minutes, 0, 0)
    
    const diffMs = newEndTime - origEndTime
    const extension_duration = Math.max(1, Math.round(diffMs / 60000))
    
    await api.put(`/activities/${id}/extend`, {
      extension_duration,
      new_end_time: newEndTime.toISOString()
    })
    
    const updatePayload = {}
    if (reason) {
      updatePayload.description = `Extension Note: ${reason}`
    } else {
      updatePayload.description = activity.description || ''
    }
    
    const updatedResponse = await api.put(`/activities/${id}`, updatePayload)
    return normalize(updatedResponse.data)
  },

  delete: async (id) => {
    await api.delete(`/activities/${id}`)
  }
}
