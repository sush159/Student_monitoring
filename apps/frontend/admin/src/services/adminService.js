import { api } from './api'
import { 
  mockAdmin, 
  mockAdminAssignedTasks, 
  mockAttendanceHistory, 
  mockProjects, 
  mockProjectUpdates 
} from '../data/mockData'

const formatAdminName = (email) => {
  if (!email) return 'Admin'
  if (email.includes('@')) {
    const part = email.split('@')[0]
    return part.charAt(0).toUpperCase() + part.slice(1)
  }
  return email
}

const getAdminName = () => {
  try {
    const stored = localStorage.getItem('admin_user')
    if (stored) {
      const user = JSON.parse(stored)
      if (user && user.name) return user.name
    }
  } catch (e) {}
  return 'Admin'
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

const getTodayKolkataDateStr = () => {
  const d = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(d)
}

const normalizeStudent = (student) => {
  if (!student) return null
  return {
    id: String(student.id),
    name: student.name,
    registerNumber: student.register_number,
    email: student.email,
    phone: student.phone || '',
    github: student.github_url || ''
  }
}

export const adminService = {
  getProfile: async () => {
    return { ...mockAdmin }
  },

  getStudents: async () => {
    const response = await api.get('/students')
    const list = Array.isArray(response.data) ? response.data : (response || [])
    return list.map(normalizeStudent)
  },

  addStudent: async (student) => {
    const payload = {
      student_id: student.registerNumber,
      roll_number: student.registerNumber,
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      github_url: student.github || ''
    }
    const response = await api.post('/students', payload)
    return normalizeStudent(response.data || response)
  },

  addStudentsBulk: async (newStudents) => {
    const payload = newStudents.map(stu => ({
      student_id: stu.registerNumber,
      roll_number: stu.registerNumber,
      name: stu.name,
      email: stu.email,
      phone: stu.phone || '',
      github_url: stu.github || ''
    }))
    const response = await api.post('/students/bulk-import', payload)
    return response.data || response
  },

  getTodayAttendance: async () => {
    const today = getTodayKolkataDateStr()
    const response = await api.get(`/attendance?date=${today}`)
    const existingList = Array.isArray(response.data) ? response.data : (response || [])
    
    const studentsRes = await api.get('/students')
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes || [])
    
    const fnMap = {}
    const anMap = {}
    existingList.forEach(r => {
      if (String(r.session).toUpperCase() === 'AFTERNOON') {
        anMap[String(r.student_id)] = r.status
      } else {
        fnMap[String(r.student_id)] = r.status
      }
    })
    
    const forenoonRecords = students.map(s => ({
      studentId: String(s.id),
      status: fnMap[String(s.id)] || 'ABSENT'
    }))
    
    const afternoonRecords = students.map(s => ({
      studentId: String(s.id),
      status: anMap[String(s.id)] || 'ABSENT'
    }))
    
    return {
      date: today,
      forenoon: {
        submitted: existingList.some(r => String(r.session).toUpperCase() === 'FORENOON'),
        records: forenoonRecords
      },
      afternoon: {
        submitted: existingList.some(r => String(r.session).toUpperCase() === 'AFTERNOON'),
        records: afternoonRecords
      }
    }
  },

  submitAttendance: async (session, records) => {
    const today = getTodayKolkataDateStr()
    return adminService.submitAttendanceForDate(today, session, records)
  },

  submitAttendanceForDate: async (dateStr, session, records, studentsList = null) => {
    const response = await api.get(`/attendance?date=${dateStr}&session=${session}`)
    const existingList = Array.isArray(response.data) ? response.data : (response || [])
    
    let students = studentsList
    if (!students) {
      const studentsRes = await api.get('/students')
      students = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes || [])
    }
    
    const regToIdMap = {}
    students.forEach(s => {
      if (s.register_number || s.registerNumber) {
        regToIdMap[String(s.register_number || s.registerNumber)] = String(s.id)
      }
      regToIdMap[String(s.id)] = String(s.id)
    })
    
    for (const record of records) {
      const numericId = regToIdMap[String(record.studentId)] || String(record.studentId)
      const existing = existingList.find(r => String(r.student_id) === numericId)
      
      const payload = {
        student_id: numericId,
        status: record.status,
        date: dateStr,
        session: session.toUpperCase()
      }
      
      if (existing) {
        await api.put(`/attendance/${existing.id}`, { status: record.status, session: session.toUpperCase(), date: dateStr })
      } else {
        await api.post(`/attendance`, payload)
      }
    }
    return true
  },

  getLeaves: async () => {
    const response = await api.get('/leave')
    const list = Array.isArray(response.data) ? response.data : (response || [])
    
    const studentsRes = await api.get('/students')
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes || [])
    const studentMap = {}
    students.forEach(s => {
      studentMap[String(s.id)] = s
    })

    return list.map(leave => {
      const stu = studentMap[String(leave.student_id)] || {}
      return {
        id: String(leave.id),
        studentId: String(leave.student_id),
        studentName: stu.name || 'Unknown Student',
        registerNumber: stu.register_number || '',
        startDate: leave.start_date ? leave.start_date.split('T')[0] : '',
        endDate: leave.end_date ? leave.end_date.split('T')[0] : '',
        fromTime: leave.start_time || '',
        toTime: leave.end_time || '',
        reason: leave.reason,
        submittedOn: leave.created_at ? leave.created_at.split('T')[0] : '',
        status: leave.status || 'PENDING'
      }
    })
  },

  getPasses: async () => {
    const response = await api.get('/movement-passes')
    const list = Array.isArray(response.data) ? response.data : (response || [])
    
    const studentsRes = await api.get('/students')
    const students = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes || [])
    const studentMap = {}
    students.forEach(s => {
      studentMap[String(s.id)] = s
    })

    const todayStr = getTodayKolkataDateStr()
    
    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const match = timeStr.trim().toLowerCase().match(/(\d+):(\d+)\s*(am|pm)/)
      if (match) {
        let hr = parseInt(match[1], 10)
        const min = parseInt(match[2], 10)
        const ampm = match[3]
        if (ampm === 'pm' && hr < 12) hr += 12
        if (ampm === 'am' && hr === 12) hr = 0
        return hr * 60 + min
      }
      return null
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

    return list.map(pass => {
      const stu = studentMap[String(pass.student_id)] || {}
      const dateStr = pass.pass_date ? formatLocalDate(pass.pass_date) : ''
      
      const timing = pass.slot_id 
        ? getSlotTiming(pass.slot_id)
        : (() => {
            const startAMPM = formatTimeAMPM(pass.out_time)
            const endAMPM = formatTimeAMPM(pass.in_time)
            return (startAMPM && endAMPM) ? `${startAMPM} - ${endAMPM}` : '09:00 AM - 05:00 PM'
          })()
      
      let computedStatus = 'ACTIVE'
      
      if (dateStr < todayStr) {
        computedStatus = 'EXPIRED'
      } else if (dateStr > todayStr) {
        computedStatus = 'UPCOMING'
      } else if (dateStr === todayStr) {
        const parts = timing.replace(/–/g, '-').replace(/to/g, '-').split('-')
        if (parts.length >= 2) {
          const startMin = parseTimeToMinutes(parts[0])
          const endMin = parseTimeToMinutes(parts[1])
          const now = new Date()
          const nowMin = now.getHours() * 60 + now.getMinutes()
          
          if (startMin !== null && endMin !== null) {
            if (nowMin > endMin) {
              computedStatus = 'EXPIRED'
            } else if (nowMin >= startMin && nowMin <= endMin) {
              computedStatus = 'ACTIVE'
            } else if (nowMin < startMin) {
              computedStatus = 'UPCOMING'
            }
          }
        }
      }

      return {
        id: String(pass.id),
        studentId: String(pass.student_id),
        studentName: stu.name || 'Unknown Student',
        registerNumber: stu.register_number || '',
        date: dateStr,
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
        status: computedStatus
      }
    })
  },

  getAssignedTasks: async () => {
    try {
      const response = await api.get('/assigned-tasks')
      const list = Array.isArray(response.data) ? response.data : (response || [])
      return list
    } catch (e) {
      console.error('Failed to fetch assigned tasks', e)
      return []
    }
  },

  getAttendanceByDate: async (dateStr) => {
    try {
      const response = await api.get(`/attendance?date=${dateStr}`)
      const existingList = Array.isArray(response.data) ? response.data : (response || [])
      
      const studentsRes = await api.get('/students')
      const students = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes || [])
      
      const fnMap = {}
      const anMap = {}
      existingList.forEach(r => {
        if (String(r.session).toUpperCase() === 'AFTERNOON') {
          anMap[String(r.student_id)] = r.status
        } else {
          fnMap[String(r.student_id)] = r.status
        }
      })
      
      const forenoonRecords = students.map(s => ({
        studentId: String(s.id),
        status: fnMap[String(s.id)] || 'ABSENT'
      }))
      
      const afternoonRecords = students.map(s => ({
        studentId: String(s.id),
        status: anMap[String(s.id)] || 'ABSENT'
      }))
      
      return {
        date: dateStr,
        forenoon: {
          submitted: existingList.some(r => String(r.session).toUpperCase() === 'FORENOON'),
          records: forenoonRecords
        },
        afternoon: {
          submitted: existingList.some(r => String(r.session).toUpperCase() === 'AFTERNOON'),
          records: afternoonRecords
        }
      }
    } catch (e) {
      console.error(`Failed to fetch attendance for date ${dateStr}`, e)
      return null
    }
  },

  getAttendanceHistory: async () => {
    try {
      const [attRes, stuRes] = await Promise.all([
        api.get('/attendance'),
        api.get('/students')
      ])
      const attList = Array.isArray(attRes.data) ? attRes.data : (attRes || [])
      const students = Array.isArray(stuRes.data) ? stuRes.data : (stuRes || [])

      // Group DB attendance by date
      const dateMap = {}
      attList.forEach(r => {
        const d = r.date ? (typeof r.date === 'string' ? r.date.split('T')[0] : formatLocalDate(r.date)) : null
        if (!d) return
        if (!dateMap[d]) {
          dateMap[d] = { forenoon: {}, afternoon: {} }
        }
        if (String(r.session).toUpperCase() === 'AFTERNOON') {
          dateMap[d].afternoon[String(r.student_id)] = r.status
        } else {
          dateMap[d].forenoon[String(r.student_id)] = r.status
        }
      })

      const dbHistory = Object.entries(dateMap).map(([dateStr, sessions]) => ({
        date: dateStr,
        forenoon: {
          submitted: Object.keys(sessions.forenoon).length > 0,
          records: students.map(s => ({
            studentId: String(s.id),
            status: sessions.forenoon[String(s.id)] || 'ABSENT'
          }))
        },
        afternoon: {
          submitted: Object.keys(sessions.afternoon).length > 0,
          records: students.map(s => ({
            studentId: String(s.id),
            status: sessions.afternoon[String(s.id)] || 'ABSENT'
          }))
        }
      }))

      // Merge with mock history for any dates not in DB
      const existingDates = new Set(dbHistory.map(h => h.date))
      const combined = [
        ...dbHistory,
        ...mockAttendanceHistory.filter(m => !existingDates.has(m.date))
      ]
      return combined.sort((a, b) => b.date.localeCompare(a.date))
    } catch (e) {
      console.error('Failed to fetch full attendance history from DB', e)
      return [...mockAttendanceHistory]
    }
  },

  getStudentActivity: async (studentId) => {
    const actRes = await api.get(`/activities?student_id=${studentId}`)
    const actList = Array.isArray(actRes.data) ? actRes.data : (actRes || [])
    
    const dailyPlan = actList.map(activity => {
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

      const timeStr = extendedEndTime 
        ? `${startTime} - ${endTime} (Ext: ${extendedEndTime})`
        : `${startTime} - ${endTime}`

      return {
        time: timeStr,
        activity: activity.activity_name
      }
    })

    const psRes = await api.get(`/student-p-skills?student_id=${studentId}`)
    const psList = Array.isArray(psRes.data) ? psRes.data : (psRes || [])
    const pskills = psList.map(sp => {
      const baseName = sp.pskill_name || sp.name
      const fullName = sp.level_code ? `${baseName} (Level ${sp.level_code})` : baseName
      return {
        name: fullName,
        status: sp.completed ? 'COMPLETED' : 'PENDING'
      }
    })

    const getWeekDateString = (dayOffset) => {
      const today = new Date()
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) + dayOffset
      const d = new Date(new Date().setDate(diff))
      const pad = (num) => String(num).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const weeklyPlan = weekDays.map((dayName, idx) => {
      const targetDateStr = getWeekDateString(idx)
      
      const dayActivities = actList.filter(act => {
        if (!act.start_time) return false
        const actDate = new Date(act.start_time)
        const pad = (num) => String(num).padStart(2, '0')
        const actDateStr = `${actDate.getFullYear()}-${pad(actDate.getMonth() + 1)}-${pad(actDate.getDate())}`
        return actDateStr === targetDateStr
      })

      const activities = dayActivities.map(act => {
        const dStart = new Date(act.start_time)
        const pad = (num) => String(num).padStart(2, '0')
        const startTime = `${pad(dStart.getHours())}:${pad(dStart.getMinutes())}`
        
        const dEnd = new Date(act.end_time)
        const endTime = `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}`
        
        let extendedEndTime = null
        if (act.extended_until) {
          const dExt = new Date(act.extended_until)
          extendedEndTime = `${pad(dExt.getHours())}:${pad(dExt.getMinutes())}`
        }

        const timeStr = extendedEndTime 
          ? `${startTime} - ${endTime} (Ext: ${extendedEndTime})`
          : `${startTime} - ${endTime}`

        return {
          goal: act.activity_name,
          time: timeStr
        }
      })

      return {
        day: dayName,
        activities
      }
    })

    return {
      project: {
        name: 'AI-Workforce Student Portal',
        role: 'Member',
        description: 'A comprehensive frontend application.'
      },
      weeklyPlan,
      dailyPlan,
      pskills,
      tasks: []
    }
  },

  getProjects: async () => {
    try {
      const response = await api.get('/teams')
      const list = Array.isArray(response.data) ? response.data : (response || [])
      return list.map(p => ({
        id: String(p.id),
        name: p.project_name || p.team_name,
        description: p.project_description || '',
        members: (p.members || []).map(m => String(m.id)),
        assignedBy: formatAdminName(p.assigned_by),
        gitRepo: p.git_repo || '',
        progress: p.progress !== undefined && p.progress !== null ? Number(p.progress) : 0,
        memberAverage: p.member_average !== undefined && p.member_average !== null ? Number(p.member_average) : Number(p.progress || 0),
        status: (p.status || 'ACTIVE').toUpperCase(),
        completedAt: p.completed_at || null,
        createdAt: p.created_at || null
      }))
    } catch (e) {
      console.error('Failed to fetch projects', e)
      return []
    }
  },

  addProject: async (project) => {
    try {
      const leadId = project.members && project.members[0] ? parseInt(project.members[0], 10) : null
      const payload = {
        team_id: 'TEAM-' + Math.floor(Math.random() * 10000),
        team_name: project.name,
        project_name: project.name,
        project_description: project.description,
        lead_student_id: leadId,
        git_repo: project.gitRepo || project.git_repo || null
      }
      const response = await api.post('/teams', payload)
      const newProj = response.data || response

      if (project.members && project.members.length > 0) {
        for (const memberId of project.members) {
          await api.post(`/teams/${newProj.id}/members`, { student_id: memberId })
        }
      }

      // Fetch the fully built team to return normalized
      const teamRes = await api.get(`/teams/${newProj.id}`)
      const team = teamRes.data || teamRes
      return {
        id: String(team.id),
        name: team.project_name || team.team_name,
        description: team.project_description || '',
        members: (team.members || []).map(m => String(m.id)),
        assignedBy: formatAdminName(team.assigned_by),
        gitRepo: team.git_repo || '',
        progress: team.progress !== undefined && team.progress !== null ? Number(team.progress) : 0,
        memberAverage: team.member_average !== undefined && team.member_average !== null ? Number(team.member_average) : Number(team.progress || 0)
      }
    } catch (e) {
      console.error('Failed to add project', e)
      throw e
    }
  },

  addTask: async (task) => {
    try {
      const payload = {
        student_id: task.studentId ? parseInt(task.studentId, 10) : 1,
        title: task.title,
        description: task.description || '',
        due_date: task.dueDate
      }
      const response = await api.post('/tasks', payload)
      const t = response.data || response
      return {
        id: String(t.id),
        title: t.title,
        description: t.description || '',
        dueDate: t.due_date ? t.due_date.split('T')[0] : '',
        status: t.status,
        studentId: String(t.student_id),
        assignedBy: formatAdminName(t.assigned_by)
      }
    } catch (e) {
      console.error('Failed to add task', e)
      throw e
    }
  },

  removeProjectMember: async (projId, studentId) => {
    try {
      await api.delete(`/teams/${projId}/members/${studentId}`)
      const teamRes = await api.get(`/teams/${projId}`)
      const team = teamRes.data || teamRes
      return {
        id: String(team.id),
        name: team.project_name || team.team_name,
        description: team.project_description || '',
        members: (team.members || []).map(m => String(m.id)),
        assignedBy: formatAdminName(team.assigned_by),
        gitRepo: team.git_repo || '',
        progress: team.progress !== undefined && team.progress !== null ? Number(team.progress) : 0
      }
    } catch (e) {
      console.error('Failed to remove project member', e)
      throw e
    }
  },

  addProjectMembers: async (projId, studentIds) => {
    try {
      for (const studentId of studentIds) {
        await api.post(`/teams/${projId}/members`, { student_id: studentId })
      }
      const teamRes = await api.get(`/teams/${projId}`)
      const team = teamRes.data || teamRes
      return {
        id: String(team.id),
        name: team.project_name || team.team_name,
        description: team.project_description || '',
        members: (team.members || []).map(m => String(m.id)),
        assignedBy: formatAdminName(team.assigned_by),
        gitRepo: team.git_repo || '',
        progress: team.progress !== undefined && team.progress !== null ? Number(team.progress) : 0
      }
    } catch (e) {
      console.error('Failed to add project members', e)
      throw e
    }
  },

  removeStudent: async (studentId) => {
    await api.delete(`/students/${studentId}`)
    return true
  },  getProjectUpdates: async () => {
    try {
      const response = await api.get('/project-updates')
      const list = Array.isArray(response.data) ? response.data : (response || [])
      let readSet = new Set()
      try {
        readSet = new Set(JSON.parse(localStorage.getItem('admin_read_updates') || '[]'))
      } catch (e) {}

      return list.map(u => {
        const isRead = readSet.has(String(u.id)) || (u.progress !== null && u.progress !== undefined)
        return {
          id: String(u.id),
          studentName: u.author_name || 'Unknown Student',
          registerNumber: u.register_number || '',
          projectName: u.project_name || 'General Project',
          projectId: u.team_code || `PRJ-${u.team_id || '101'}`,
          teamId: String(u.team_id),
          message: u.content || '',
          content: u.content || '',
          gitRepo: u.git_repo || u.team_git_repo || '',
          studentProgress: u.student_progress !== undefined && u.student_progress !== null ? Number(u.student_progress) : null,
          progress: u.progress !== undefined && u.progress !== null ? Number(u.progress) : null,
          adminFeedback: u.admin_feedback || '',
          reviewedBy: u.reviewed_by ? formatAdminName(u.reviewed_by) : '',
          reviewedAt: u.reviewed_at || '',
          timestamp: u.created_at,
          read: Boolean(isRead)
        }
      })
    } catch (e) {
      console.error('Failed to fetch project updates', e)
      return []
    }
  },

  sendUpdateProgress: async (updateId, { progress, admin_feedback }) => {
    const response = await api.patch(`/project-updates/${updateId}/progress`, {
      progress: Number(progress),
      admin_feedback: admin_feedback || ''
    })
    // Auto mark as read when reviewed
    try {
      const readSet = new Set(JSON.parse(localStorage.getItem('admin_read_updates') || '[]'))
      readSet.add(String(updateId))
      localStorage.setItem('admin_read_updates', JSON.stringify([...readSet]))
    } catch (e) {}
    return response.data || response
  },

  updateProjectProgressRate: async (projectId, progress) => {
    const response = await api.patch(`/teams/${projectId}/progress`, {
      progress: Number(progress)
    })
    return response.data || response
  },

  completeProject: async (projectId) => {
    const response = await api.patch(`/teams/${projectId}/complete`, {
      status: 'COMPLETED'
    })
    return response.data || response
  },

  updateProjectStatus: async (projectId, status) => {
    const response = await api.patch(`/teams/${projectId}/status`, {
      status: String(status).toUpperCase()
    })
    return response.data || response
  },

  getSpecificProjectUpdates: async (teamId) => {
    try {
      const response = await api.get(`/project-updates?team_id=${teamId}`)
      const list = Array.isArray(response.data) ? response.data : (response || [])
      let readSet = new Set()
      try {
        readSet = new Set(JSON.parse(localStorage.getItem('admin_read_updates') || '[]'))
      } catch (e) {}

      return list.map(u => ({
        id: String(u.id),
        studentName: u.author_name || 'Unknown Student',
        registerNumber: u.register_number || '',
        projectName: u.project_name || 'General Project',
        projectId: u.team_code || `PRJ-${u.team_id || '101'}`,
        teamId: String(u.team_id),
        message: u.content || '',
        content: u.content || '',
        gitRepo: u.git_repo || u.team_git_repo || '',
        studentProgress: u.student_progress !== undefined && u.student_progress !== null ? Number(u.student_progress) : null,
        progress: u.progress !== undefined && u.progress !== null ? Number(u.progress) : null,
        adminFeedback: u.admin_feedback || '',
        reviewedBy: u.reviewed_by ? formatAdminName(u.reviewed_by) : '',
        reviewedAt: u.reviewed_at || '',
        timestamp: u.created_at,
        read: readSet.has(String(u.id)) || (u.progress !== null && u.progress !== undefined)
      }))
    } catch (e) {
      console.error('Failed to fetch specific project updates', e)
      return []
    }
  },

  markUpdateAsRead: async (updateId, isRead = true) => {
    try {
      const readSet = new Set(JSON.parse(localStorage.getItem('admin_read_updates') || '[]'))
      if (isRead) {
        readSet.add(String(updateId))
      } else {
        readSet.delete(String(updateId))
      }
      localStorage.setItem('admin_read_updates', JSON.stringify([...readSet]))
      return true
    } catch (e) {
      console.error('Failed to toggle update read state', e)
      return true
    }
  },

  listAdmins: async () => {
    try {
      const response = await api.get('/auth/admins')
      const list = Array.isArray(response.data) ? response.data : (response || [])
      return list
    } catch (e) {
      console.error('Failed to fetch admins', e)
      return []
    }
  },

  createAdmin: async ({ email, password }) => {
    const response = await api.post('/auth/admins', { email, password })
    return response.data || response
  }
}
