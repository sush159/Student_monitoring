import { api, getStudentDbId } from './api'

const formatAdminName = (email) => {
  if (!email) return 'Admin'
  if (email.includes('@')) {
    const part = email.split('@')[0]
    return part.charAt(0).toUpperCase() + part.slice(1)
  }
  return email
}

const normalizeProject = (team) => {
  if (!team) return null
  return {
    id: String(team.id),
    title: team.project_name || 'No Project Assigned',
    description: team.project_description || '',
    teamId: team.team_id,
    lead: team.lead_name || 'No Lead',
    members: (team.members || []).map(m => m.name),
    assignedBy: formatAdminName(team.assigned_by),
    gitRepo: team.git_repo || '',
    progress: team.progress !== undefined && team.progress !== null ? Number(team.progress) : 0,
    memberAverage: team.member_average !== undefined && team.member_average !== null ? Number(team.member_average) : Number(team.progress || 0),
    status: (team.status || 'ACTIVE').toUpperCase(),
    completedAt: team.completed_at || null,
    history: (team.history || []).map(h => ({
      id: String(h.id),
      title: h.project_name || '',
      description: h.project_description || '',
      teamId: h.team_id,
      members: (h.members || []).map(m => m.name),
      assignedBy: formatAdminName(h.assigned_by),
      gitRepo: h.git_repo || '',
      progress: h.progress !== undefined && h.progress !== null ? Number(h.progress) : 0,
      status: (h.status || 'ACTIVE').toUpperCase(),
      completedAt: h.completed_at || null,
      assignedOn: h.created_at ? h.created_at.split('T')[0] : ''
    }))
  }
}

const normalizeUpdate = (upd) => {
  if (!upd) return null
  return {
    id: String(upd.id),
    author: upd.author_name || 'Unknown',
    registerNumber: upd.register_number || '',
    avatar: (upd.author_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    timestamp: upd.created_at,
    content: upd.content,
    gitRepo: upd.git_repo || upd.team_git_repo || '',
    studentProgress: upd.student_progress !== undefined && upd.student_progress !== null ? Number(upd.student_progress) : null,
    progress: upd.progress !== undefined && upd.progress !== null ? Number(upd.progress) : null,
    adminFeedback: upd.admin_feedback || '',
    reviewedBy: upd.reviewed_by ? formatAdminName(upd.reviewed_by) : '',
    reviewedAt: upd.reviewed_at || ''
  }
}

export const projectService = {
  get: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return null
    try {
      const response = await api.get(`/teams/student/${studentId}`)
      const team = response.data || response
      if (!team || !team.id) return null
      return normalizeProject(team)
    } catch (e) {
      console.error('Failed to fetch team details', e)
      return null
    }
  },

  getUpdates: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    try {
      const teamRes = await api.get(`/teams/student/${studentId}`)
      const team = teamRes.data || teamRes
      if (!team || !team.id) return []

      const response = await api.get(`/project-updates?team_id=${team.id}`)
      const list = Array.isArray(response.data) ? response.data : (response || [])
      return list.map(normalizeUpdate)
    } catch (e) {
      console.error('Failed to fetch project updates', e)
      return []
    }
  },

  addUpdate: async (data) => {
    const studentId = await getStudentDbId()
    const teamRes = await api.get(`/teams/student/${studentId}`)
    const team = teamRes.data || teamRes
    if (!team || !team.id) {
      throw new Error('No team assigned to post updates.')
    }

    const response = await api.post('/project-updates', {
      student_id: studentId,
      team_id: team.id,
      content: data.content,
      git_repo: data.gitRepo || data.git_repo || null,
      student_progress: data.studentProgress !== undefined && data.studentProgress !== null ? Number(data.studentProgress) : null
    })
    
    // Fetch newly created update and return it normalized
    const created = response.data || response
    return normalizeUpdate({
      ...created,
      author_name: data.author,
      register_number: data.registerNumber,
      git_repo: data.gitRepo || data.git_repo || created.git_repo,
      student_progress: data.studentProgress !== undefined && data.studentProgress !== null ? Number(data.studentProgress) : null
    })
  },

  updateRepo: async (teamId, gitRepo) => {
    const response = await api.post(`/teams/${teamId}/repo`, { git_repo: gitRepo })
    return response.data || response
  }
}

