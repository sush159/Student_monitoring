import { api, getStudentDbId } from './api'

export const PSKILL_SLOTS = {
  'P-Skill Slot A': { label: 'P-Skill Slot A', timing: '10:00 AM – 11:00 AM' },
  'P-Skill Slot B': { label: 'P-Skill Slot B', timing: '11:00 AM – 12:00 PM' },
  'P-Skill Slot C': { label: 'P-Skill Slot C', timing: '02:00 PM – 03:00 PM' },
}

const formatTimeAMPM = (dateIsoStr) => {
  if (!dateIsoStr) return null
  if (typeof dateIsoStr === 'string') {
    const timeMatch = dateIsoStr.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch && !dateIsoStr.includes('Z')) {
      let hr = parseInt(timeMatch[1], 10)
      const min = timeMatch[2]
      const ampm = hr >= 12 ? 'PM' : 'AM'
      hr = hr % 12 || 12
      return `${String(hr).padStart(2, '0')}:${min} ${ampm}`
    }
  }
  const d = new Date(dateIsoStr)
  if (isNaN(d.getTime())) return null
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return formatter.format(d)
}

const getSlotTiming = (id) => {
  const slotMap = {
    '1': '08:45 AM - 09:45 AM',
    '2': '10:00 AM - 11:00 AM',
    '3': '11:20 AM - 12:20 PM',
    '4': '01:30 PM - 02:30 PM',
    '5': '03:20 PM - 04:20 PM'
  }
  return slotMap[String(id)] || '09:00 AM - 05:00 PM'
}

const formatLocalDate = (dateIsoStr) => {
  if (!dateIsoStr) return ''
  const d = new Date(dateIsoStr)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(d)
}

const normalize = (pass) => {
  if (!pass) return null
  
  const timing = pass.slot_id 
    ? getSlotTiming(pass.slot_id)
    : (() => {
        const startAMPM = formatTimeAMPM(pass.out_time)
        const endAMPM = formatTimeAMPM(pass.in_time)
        return (startAMPM && endAMPM) ? `${startAMPM} - ${endAMPM}` : '09:00 AM - 05:00 PM'
      })()

  return {
    id: String(pass.id),
    date: pass.pass_date ? formatLocalDate(pass.pass_date) : '',
    movementType: pass.pass_type === 'LAB_ACCESS' ? 'Lab Access' : 
                  pass.pass_type === 'CAMPUS_LEAVE' ? 'Campus Leave' : 
                  pass.pass_type === 'RESEARCH_PARK' ? 'Research Park' :
                  pass.pass_type === 'PS_SLOT' ? 'PS Slot' :
                  pass.pass_type === 'IECC' ? 'IECC' :
                  pass.pass_type === 'MC' ? 'MC' :
                  pass.pass_type === 'LIBRARY' ? 'Library' :
                  pass.pass_type ? pass.pass_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Other',
    slot: pass.slot_id ? `P-Skill Slot ${pass.slot_id}` : 'General Slot',
    timing: timing,
    reason: pass.purpose || pass.reason || '',
    skillName: '',
    status: pass.status || 'PENDING'
  }
}

export const movementService = {
  getAll: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    const response = await api.get(`/movement-passes?student_id=${studentId}`)
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalize).sort((a, b) => b.date.localeCompare(a.date))
  },

  create: async ({ date, movementType, slot, timing: inputTiming, reason, skillName }) => {
    let timing = slot === 'Custom Time' ? inputTiming : (PSKILL_SLOTS[slot]?.timing || slot.replace(/^.+?\((.+)\)$/, '$1'))
    timing = timing.replace(/\./g, ':')
    
    const parts = timing.replace(/–/g, '-').replace(/to/g, '-').split('-')
    let start = '09:00:00'
    let end = '17:00:00'
    const parseTime = (timeStr) => {
      const clean = timeStr.trim().toLowerCase()
      // Try 12-hour match first
      const match12 = clean.match(/(\d+):(\d+)\s*(am|pm)/)
      if (match12) {
        let hr = parseInt(match12[1], 10)
        const min = parseInt(match12[2], 10)
        const ampm = match12[3]
        if (ampm === 'pm' && hr < 12) hr += 12
        if (ampm === 'am' && hr === 12) hr = 0
        return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
      }
      // Try 24-hour match
      const match24 = clean.match(/^(\d+):(\d+)$/)
      if (match24) {
        const hr = parseInt(match24[1], 10)
        const min = parseInt(match24[2], 10)
        return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
      }
      return null
    }
    if (parts.length >= 2) {
      const s = parseTime(parts[0])
      const e = parseTime(parts[1])
      if (s) start = s
      if (e) end = e
    }

    const out_time = `${date}T${start}`
    const in_time = `${date}T${end}`
    
    const student_id = await getStudentDbId()

    let pass_type = 'OTHER'
    const cleanType = movementType.trim().toLowerCase()
    if (cleanType.includes('lab')) pass_type = 'LAB_ACCESS'
    else if (cleanType.includes('campus') || cleanType.includes('leave')) pass_type = 'CAMPUS_LEAVE'
    else if (cleanType.includes('ps') || cleanType.includes('skill')) pass_type = 'PS_SLOT'
    else if (cleanType === 'iecc') pass_type = 'IECC'
    else if (cleanType === 'library') pass_type = 'LIBRARY'
    else if (cleanType.includes('research') || cleanType.includes('park')) pass_type = 'RESEARCH_PARK'
    else if (cleanType === 'mc') pass_type = 'MC'

    let slot_id = null
    if (slot.includes('8.45') || slot.includes('8:45')) slot_id = 1
    else if (slot.includes('10.00') || slot.includes('10:00')) slot_id = 2
    else if (slot.includes('11.20') || slot.includes('11:20')) slot_id = 3
    else if (slot.includes('1.30') || slot.includes('13:30') || slot.includes('1:30')) slot_id = 4
    else if (slot.includes('3.20') || slot.includes('15:25') || slot.includes('3:20')) slot_id = 5

    const payload = {
      student_id,
      pass_type,
      purpose: reason,
      out_time,
      in_time,
      slot_id
    }

    const response = await api.post('/movement-passes', payload)
    return {
      ...normalize(response.data),
      timing
    }
  },

  getSlotTiming: (slot) => {
    return PSKILL_SLOTS[slot]?.timing || null
  }
}
