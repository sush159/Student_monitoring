import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, FileText, MapPin, CheckCircle2, Clock, Plus, ArrowRight,
  ClipboardList, AlertCircle, XCircle, Send, Info, Github, ExternalLink, GitBranch,
  Edit3, Check, MessageSquare, History, Archive
} from 'lucide-react'


import { format, formatDistanceToNow } from 'date-fns'
import StatusBadge from '../components/common/StatusBadge'
import ProgressIndicator from '../components/common/ProgressIndicator'
import Modal from '../components/common/Modal'
import { useAuth } from '../contexts/AuthContext'
import { activityService } from '../services/activityService'
import { movementService } from '../services/movementService'
import { assignedTaskService } from '../services/assignedTaskService'
import { profileService } from '../services/profileService'
import { projectService } from '../services/projectService'
import { attendanceService } from '../services/attendanceService'

const safeFormatDistance = (dateVal) => {
  if (!dateVal) return ''
  try {
    let d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal
    if (!d || isNaN(d.getTime())) return String(dateVal)
    
    const now = new Date()
    // If the parsed date is slightly in the future (within 2 minutes), treat as "just now"
    if (d > now) {
      const diffMs = d.getTime() - now.getTime()
      if (diffMs <= 2 * 60 * 1000) {
        return 'just now'
      }
      // If it's shifted by ~5.5 hours (UTC/IST mixup), subtract the 5.5 hour offset
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours >= 5 && diffHours <= 6) {
        d = new Date(d.getTime() - 5.5 * 60 * 60 * 1000)
      }
    }
    
    return formatDistanceToNow(d, { addSuffix: true })
  } catch (e) {
    return String(dateVal)
  }
}


const QUICK_LINKS = [
  { to: '/daily-plan', icon: CalendarDays, label: 'Daily Plan', color: 'primary' },
  { to: '/leave', icon: FileText, label: 'Apply Leave', color: 'warning' },
  { to: '/movement-pass', icon: MapPin, label: 'Movement Pass', color: 'success' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [todayActivities, setTodayActivities] = useState([])
  const [activePass, setActivePass] = useState(null)
  const [assignedTasks, setAssignedTasks] = useState([])
  const [profile, setProfile] = useState(null)
  const [project, setProject] = useState(null)
  const [updates, setUpdates] = useState([])
  const [todayAttendance, setTodayAttendance] = useState({ forenoon: 'Pending', afternoon: 'Pending' })
  const [loading, setLoading] = useState(true)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showPastTasksModal, setShowPastTasksModal] = useState(false)

  // Project Updates Modal Tabs & Posting State
  const [modalTab, setModalTab] = useState('details')
  const [isPosting, setIsPosting] = useState(false)
  const [newUpdateContent, setNewUpdateContent] = useState('')
  const [newUpdateProgress, setNewUpdateProgress] = useState(75)
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false)

  // Team Git Repository Edit State
  const [isEditingRepo, setIsEditingRepo] = useState(false)
  const [repoEditValue, setRepoEditValue] = useState('')
  const [isSavingRepo, setIsSavingRepo] = useState(false)

  const handleCompleteTask = async (id) => {
    await assignedTaskService.markCompleted(id)
    setAssignedTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'COMPLETED' } : t))
  }

  const handleSaveRepo = async (e) => {
    if (e) e.preventDefault()
    if (!project?.id) return
    setIsSavingRepo(true)
    try {
      const cleanRepo = repoEditValue.trim()
      await projectService.updateRepo(project.id, cleanRepo)
      setProject(prev => prev ? ({ ...prev, gitRepo: cleanRepo }) : prev)
      setIsEditingRepo(false)
    } catch (err) {
      console.error('Failed to update team repository', err)
    } finally {
      setIsSavingRepo(false)
    }
  }

  const handlePostUpdate = async (e) => {
    e.preventDefault()
    if (!newUpdateContent.trim()) return
    setIsSubmittingUpdate(true)
    try {
      const authorName = profile?.name || user?.name || 'Priya Ramesh'
      const authorRole = 'Member'
      const newUpd = await projectService.addUpdate({
        author: authorName,
        registerNumber: profile?.registerNumber || profile?.register_number || user?.registerNumber || '',
        role: authorRole,
        content: newUpdateContent,
        gitRepo: project?.gitRepo || null,
        studentProgress: Number(newUpdateProgress)
      })
      setUpdates(prev => [newUpd, ...prev])
      setNewUpdateContent('')
      setNewUpdateProgress(75)
      setIsPosting(false)
      setModalTab('chat')
    } catch (error) {
      console.error("Failed to post update", error)
    } finally {
      setIsSubmittingUpdate(false)
    }
  }

  const handleOpenProjectModal = async (tab = 'details') => {
    setModalTab(tab)
    setIsEditingRepo(false)
    if (project?.gitRepo) {
      setRepoEditValue(project.gitRepo)
    }
    setShowProjectModal(true)
    try {
      const [proj, upds] = await Promise.all([
        projectService.get(),
        projectService.getUpdates()
      ])
      if (proj) {
        setProject(proj)
        setRepoEditValue(proj.gitRepo || '')
      }
      if (upds) setUpdates(upds)
    } catch (e) {
      console.error('Failed to refresh project data on modal open', e)
    }
  }

  const handleCloseProjectModal = () => {
    setShowProjectModal(false)
    setModalTab('details')
    setIsPosting(false)
    setIsEditingRepo(false)
    setNewUpdateContent('')
    setNewUpdateProgress(75)
  }



  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const isPassActiveNow = (pass) => {
    if (!pass || !pass.date) return false
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    if (pass.date !== todayStr) return false

    // Parse timing: e.g. "10:00 AM - 11:00 AM" or "09:00 AM - 05:00 PM"
    const timing = pass.timing || '09:00 AM - 05:00 PM'
    const parts = timing.replace(/–/g, '-').replace(/to/g, '-').split('-')
    if (parts.length < 2) return true // Fallback if no timing range

    const parseTimeToMinutes = (timeStr) => {
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

    const startMin = parseTimeToMinutes(parts[0])
    const endMin = parseTimeToMinutes(parts[1])
    if (startMin === null || endMin === null) return true // Fallback

    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return nowMin >= startMin && nowMin <= endMin
  }

  useEffect(() => {
    Promise.all([
      activityService.getByDate(todayStr),
      movementService.getAll(),
      assignedTaskService.getAll(),
      profileService.get(),
      projectService.get(),
      projectService.getUpdates(),
      attendanceService.getAll()
    ]).then(([acts, passes, tasks, prof, proj, upds, attRecs]) => {
      setTodayActivities(acts)
      const active = passes.find(p => p.status === 'ACTIVE' || isPassActiveNow(p))
      setActivePass(active)
      setAssignedTasks(tasks)
      setProfile(prof || user)
      setProject(proj)
      setUpdates(upds)
      
      const todayAtts = attRecs.filter(r => r.date === todayStr)
      const forenoonRec = todayAtts.find(r => r.session.toLowerCase() === 'forenoon')
      const afternoonRec = todayAtts.find(r => r.session.toLowerCase() === 'afternoon')
      
      const fnStatus = forenoonRec ? (forenoonRec.status === 'PRESENT' ? 'Present' : 'Absent') : 'Pending'
      const anStatus = afternoonRec ? (afternoonRec.status === 'PRESENT' ? 'Present' : 'Absent') : 'Pending'
      
      setTodayAttendance({ forenoon: fnStatus, afternoon: anStatus })
    })
    .catch(err => {
      console.error('Dashboard data load failed:', err)
    })
    .finally(() => {
      setLoading(false)
    })

    // Real-time synchronization: Poll every 4 seconds for new admin progress replies & team rates
    const syncInterval = setInterval(() => {
      Promise.all([
        projectService.get(),
        projectService.getUpdates()
      ]).then(([proj, upds]) => {
        if (proj) setProject(proj)
        if (upds) setUpdates(upds)
      }).catch(() => {})
    }, 4000)

    return () => clearInterval(syncInterval)
  }, [todayStr, user])


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const renderMyProjectCard = () => {
    return (
      <div>
        <h2 className="text-base font-bold text-text-primary mb-3">My Team</h2>
        {project ? (
          <button
            onClick={() => handleOpenProjectModal('details')}
            className="w-full card bg-primary-light border border-primary/20 hover:border-primary transition-all duration-200 text-left flex flex-col gap-3 group"
          >
            {/* Top Row: Team Code + Git Repo Badge */}
            <div className="flex items-center justify-between gap-2 w-full flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black text-primary uppercase tracking-wide bg-white/80 px-2 py-0.5 rounded-md border border-primary/10 font-mono">
                  Team: {project.teamId}
                </span>
                {project.status === 'COMPLETED' && (
                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 uppercase tracking-wider">
                    ✔ Completed
                  </span>
                )}
              </div>
              {project.gitRepo ? (
                <a
                  href={project.gitRepo.startsWith('http') ? project.gitRepo : `https://${project.gitRepo}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold hover:bg-black transition-colors shadow-xs"
                  title="Open GitHub Repository"
                >
                  <Github className="w-3 h-3 text-white flex-shrink-0" />
                  <span className="truncate max-w-[140px]">{project.gitRepo.replace(/^https?:\/\/(www\.)?github\.com\//, '')}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70 flex-shrink-0" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/60 text-[9px] font-bold text-text-muted">
                  <Github className="w-3 h-3 text-text-muted" /> No Repo Linked
                </span>
              )}
            </div>

            {/* Project Title & Description */}
            <div className="space-y-1 w-full">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-bold text-text-primary leading-snug group-hover:text-primary transition-colors">
                  {project.title}
                </p>
                <div className="p-1.5 bg-white rounded-lg flex-shrink-0 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 font-semibold">
                  {project.description}
                </p>
              )}
            </div>

            {/* Progress Bar & Assigned By */}
            <div className="pt-2 border-t border-primary/10 w-full space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-text-secondary uppercase tracking-wider">Project Progress</span>
                  <span className={project.status === 'COMPLETED' ? 'text-emerald-700 font-black' : 'text-primary font-black'}>
                    {project.progress || 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      project.status === 'COMPLETED' ? 'bg-emerald-600' : 'bg-primary'
                    }`} 
                    style={{ width: `${Math.min(100, Math.max(0, project.progress || 0))}%` }} 
                  />
                </div>
              </div>

              <div className="text-[11px] text-text-secondary font-medium">
                <span className="font-bold text-primary">Assigned By:</span> {project.assignedBy || 'Admin'}
              </div>
            </div>
          </button>
        ) : (
          <div className="w-full card bg-gray-50 border border-gray-150 p-4 text-center">
            <p className="text-xs font-black text-text-muted uppercase tracking-wider">Project Title</p>
            <p className="text-sm font-bold text-text-secondary mt-1">Not Assigned</p>
          </div>
        )}
      </div>
    )
  }

  const renderAssignedTasks = () => {
    const pendingTasks = assignedTasks.filter(t => t.status === 'PENDING')
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text-primary">Assigned Tasks</h2>
          <button onClick={() => setShowPastTasksModal(true)} className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary-dark transition-colors">
            View Past <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="card">
          {pendingTasks.length === 0 ? (
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">No assigned tasks</p>
                <p className="text-xs text-text-muted mt-0.5">You're all caught up!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-3 rounded-xl hover:shadow-md cursor-pointer transition-all border border-transparent hover:border-primary/20 group">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{task.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">Assigned by {task.assignedBy} • Due {task.dueDate}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }} 
                    className="self-end sm:self-auto shrink-0 px-3 py-1.5 bg-primary-light text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-white transition-colors flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderActivePass = () => {
    return (
      <div>
        <h2 className="text-base font-bold text-text-primary mb-3">Active Movement Pass</h2>
        <div className="card bg-success-soft border border-green-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">{activePass.movementType}</p>
              <p className="text-xs text-green-700 font-medium mt-0.5">{activePass.timing}</p>
            </div>
          </div>
          <div className="bg-white/60 px-3 py-2 rounded-xl mt-3">
            <p className="text-xs text-green-800">{activePass.reason}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderAssignedTasksWithFallback = () => {
    const pendingTasks = assignedTasks.filter(t => t.status === 'PENDING')
    if (pendingTasks.length > 0) {
      return renderAssignedTasks()
    }
    if (activePass) {
      return (
        <div>
          <h2 className="text-base font-bold text-text-primary mb-3">Active Movement Pass</h2>
          <div className="card bg-success-soft border border-green-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-800 font-semibold uppercase tracking-wide">Active Pass (No pending tasks)</p>
                <p className="text-sm font-bold text-green-800 mt-0.5">{activePass.movementType}</p>
                <p className="text-xs text-green-700 font-medium mt-0.5">{activePass.timing}</p>
              </div>
            </div>
            <div className="bg-white/60 px-3 py-2 rounded-xl mt-3">
              <p className="text-xs text-green-800">{activePass.reason}</p>
            </div>
          </div>
        </div>
      )
    }
    return renderAssignedTasks()
  }

  const renderTodayActivities = () => {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text-primary">Today's Activities</h2>
          <Link to="/daily-plan" className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary-dark transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {todayActivities.length === 0 ? (
          <div className="card text-center py-10">
            <CalendarDays className="w-10 h-10 text-primary-light mx-auto mb-3" />
            <p className="text-sm font-semibold text-text-primary">No activities today</p>
            <p className="text-xs text-text-muted mt-1">Head to Daily Plan to add your first activity</p>
            <Link to="/daily-plan" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm">
              <Plus className="w-4 h-4" />
              Add Activity
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todayActivities.slice(0, 3).map(act => (
              <div key={act.id} className="card border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary leading-snug">{act.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{act.startTime} – {act.extendedEndTime || act.endTime}</p>
                  </div>
                  <StatusBadge status={act.status} />
                </div>
                <ProgressIndicator value={act.progress} />
              </div>
            ))}
            {todayActivities.length > 3 && (
              <Link to="/daily-plan" className="block text-center py-3 text-sm text-primary font-semibold hover:text-primary-dark transition-colors">
                +{todayActivities.length - 3} more activities →
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderProjectUpdatesWidget = () => {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text-primary">Project Updates</h2>
          <button 
            onClick={() => handleOpenProjectModal('chat')} 
            className="text-xs text-primary font-semibold hover:text-primary-dark transition-colors flex items-center gap-0.5 cursor-pointer"
          >
            View Chat <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="card space-y-3">
          {/* Top Git Repo quick indicator */}
          {project?.gitRepo && (
            <div className="bg-gray-900 text-white px-3 py-2 rounded-xl flex items-center justify-between gap-2 shadow-xs text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Github className="w-3.5 h-3.5 text-white flex-shrink-0" />
                <span className="text-[10px] font-bold text-gray-300 truncate">
                  {project.gitRepo.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                </span>
              </div>
              <a
                href={project.gitRepo.startsWith('http') ? project.gitRepo : `https://${project.gitRepo}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-primary-light hover:underline font-bold flex items-center gap-1 flex-shrink-0"
              >
                Repo <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}

          {updates.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-xs">
              No updates posted yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 -my-2.5">
              {updates.slice(0, 3).map((upd) => (
                <div key={upd.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-primary-light text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {upd.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-text-primary truncate max-w-[110px] inline-block align-middle">{upd.author}</p>
                        <span className="text-[9px] text-text-muted ml-1.5 inline-block align-middle">{safeFormatDistance(upd.timestamp)}</span>
                      </div>
                    </div>

                    {upd.progress !== null && upd.progress !== undefined ? (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                        Admin: {upd.progress}%
                      </span>
                    ) : (
                      <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed pl-6 font-medium">
                    {upd.content}
                  </p>
                  {upd.adminFeedback && (
                    <div className="ml-6 mt-1 p-2 rounded-lg bg-green-50/90 border border-green-200/80 text-[10px] text-green-950 font-semibold flex items-center justify-between gap-2">
                      <span className="truncate italic">"{upd.adminFeedback}"</span>
                      <span className="text-[9px] font-bold text-green-700 whitespace-nowrap">✓ Reply Sent</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    )
  }

  return (
    <div className="space-y-4">
      {/* Premium Greeting Hero */}
      <div className="card bg-primary-light border border-primary/20 shadow-sm flex items-center justify-between p-6 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-primary text-2xl font-black shadow-sm">
            {profile?.name?.charAt(0) || 'S'}
          </div>
          <div>
            <h1 className="text-xl font-black text-text-primary">
              {greeting()}, <span className="text-primary">{profile?.name?.split(' ')[0] || 'Student'}</span>
            </h1>
            <p className="text-text-secondary text-sm mt-0.5 font-medium tracking-wide">
              {format(new Date(), 'EEEE, dd MMMM yyyy')} • Let's make today productive.
            </p>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
      </div>

      {/* Today's Attendance (Compact on Mobile) */}
      <div className="card bg-white border border-gray-100 flex flex-row items-center justify-between gap-2 p-2.5 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-text-primary">Today's Attendance</h2>
            <p className="text-[10px] sm:text-xs text-text-muted hidden sm:block">
              {todayAttendance.forenoon === 'Present' && todayAttendance.afternoon === 'Present' ? 'Marked successfully for today' :
               todayAttendance.forenoon === 'Present' ? 'Marked successfully for Forenoon' :
               todayAttendance.afternoon === 'Present' ? 'Marked successfully for Afternoon' :
               'Today\'s attendance is pending'}
            </p>
          </div>
        </div>
        <div className="flex flex-row gap-1.5 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between items-center bg-background px-2 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl sm:min-w-[140px]">
            <span className="text-[9px] sm:text-sm font-semibold text-text-secondary sm:mr-4">Forenoon</span>
            {todayAttendance.forenoon === 'Present' ? (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-green-600">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Present</span>
              </span>
            ) : todayAttendance.forenoon === 'Absent' ? (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-red-600">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Absent</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-text-muted">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Pending</span>
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between items-center bg-background px-2 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl sm:min-w-[140px]">
            <span className="text-[9px] sm:text-sm font-semibold text-text-secondary sm:mr-4">Afternoon</span>
            {todayAttendance.afternoon === 'Present' ? (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-green-600">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Present</span>
              </span>
            ) : todayAttendance.afternoon === 'Absent' ? (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-red-600">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Absent</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-bold text-text-muted">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Pending</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 animate-fade-in">
        {/* Desktop Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {renderAssignedTasks()}
          {renderTodayActivities()}
        </div>
        {/* Desktop Right Column */}
        <div className="space-y-4">
          {activePass && renderActivePass()}
          {renderMyProjectCard()}
          {renderProjectUpdatesWidget()}
        </div>
      </div>

      {/* Responsive/Mobile Layout */}
      <div className="lg:hidden space-y-4 animate-fade-in">
        {renderMyProjectCard()}
        {renderAssignedTasksWithFallback()}
        {renderTodayActivities()}
        {renderProjectUpdatesWidget()}
      </div>

      {/* Project Modal */}
      {project && (
        <Modal open={showProjectModal} onClose={handleCloseProjectModal} title="Project Details" size="md">
          {/* Top Banner: Git Repo & Overall Progress (Pinned always at top with Edit option) */}
          <div className="bg-gray-900 text-white p-3.5 rounded-2xl mb-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white flex-shrink-0 shadow-inner">
                  <Github className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">GitHub Repository</p>
                    {!isEditingRepo && (
                      <button
                        type="button"
                        onClick={() => {
                          setRepoEditValue(project.gitRepo || '')
                          setIsEditingRepo(true)
                        }}
                        className="text-[10px] font-bold text-primary-light hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{project.gitRepo ? 'Edit Repo' : '+ Add Repo'}</span>
                      </button>
                    )}
                  </div>

                  {!isEditingRepo ? (
                    project.gitRepo ? (
                      <a
                        href={project.gitRepo.startsWith('http') ? project.gitRepo : `https://${project.gitRepo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-white hover:text-primary-light hover:underline truncate block flex items-center gap-1"
                      >
                        <span className="truncate">{project.gitRepo}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-75" />
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium italic">No repository attached yet</p>
                    )
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold">Progress</span>
                <span className="text-sm font-black text-green-400">{project.progress || 0}%</span>
              </div>
            </div>

            {/* Inline Git Repo Edit Form */}
            {isEditingRepo && (
              <form onSubmit={handleSaveRepo} className="pt-2 border-t border-white/10 flex items-center gap-2 animate-fade-in">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://github.com/org/repo..."
                    value={repoEditValue}
                    onChange={(e) => setRepoEditValue(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:border-primary"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingRepo(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-300 transition-colors"
                  disabled={isSavingRepo}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRepo}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-xs font-bold text-white transition-colors flex items-center gap-1"
                >
                  {isSavingRepo ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3 h-3" /> Save
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Completion Celebration Banner */}
          {project.status === 'COMPLETED' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-4 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black flex-shrink-0">
                ✓
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-950">Project Completed & Moved to History</p>
                <p className="text-[10px] text-emerald-700 font-medium">Final Progress Score: 100% • Successfully Delivered</p>
              </div>
            </div>
          )}

          {/* Modal Tabs: 1. Details, 2. Chat, 3. History */}
          <div className="flex border-b border-gray-100 mb-4 -mx-6 px-6 gap-2">
            {/* Tab 1: Details */}
            <button
              onClick={() => { setModalTab('details'); setIsPosting(false); }}
              className={`pb-2 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'details' && !isPosting
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            {/* Tab 2: Chat (Current Project Updates & Feedback) */}
            <button
              onClick={() => { setModalTab('chat'); setIsPosting(false); }}
              className={`pb-2 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'chat'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {updates.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  modalTab === 'chat' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-text-secondary'
                }`}>
                  {updates.length}
                </span>
              )}
            </button>

            {/* Tab 3: History (Past Projects) */}
            <button
              onClick={() => { setModalTab('history'); setIsPosting(false); }}
              className={`pb-2 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {project.history && project.history.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  modalTab === 'history' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-text-secondary'
                }`}>
                  {project.history.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: DETAILS */}
          {modalTab === 'details' && (
            !isPosting ? (
              <div className="space-y-4 animate-scale-in">
                <div>
                  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Project Title</p>
                  <p className="text-base font-bold text-text-primary">{project.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Description</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{project.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Team ID</p>
                    <p className="text-sm font-bold text-text-primary">{project.teamId}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Assigned By</p>
                    <p className="text-sm font-bold text-text-primary">{project.assignedBy || 'Admin'}</p>
                  </div>
                </div>
                <div className="bg-background rounded-xl p-3">
                  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Members</p>
                  <ul className="space-y-1">
                    {project.members.map((member, i) => (
                      <li key={i} className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {member}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsPosting(true)
                    }}
                    className="w-full btn-primary flex items-center justify-center gap-1.5 text-xs py-2.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Post Update
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePostUpdate} className="space-y-4 animate-scale-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary">Post Project Update</h3>
                  <span className="text-[10px] text-text-muted">Posting as {profile?.name || user?.name || 'Priya Ramesh'}</span>
                </div>

                {/* Info Bar: Team Git Repo Linked */}
                <div className="bg-primary-light/15 border border-primary/20 rounded-xl p-3 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Github className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-text-muted font-bold block uppercase tracking-wider">Linked Team Repository</span>
                      <span className="text-xs font-bold text-text-primary truncate block font-mono">
                        {project.gitRepo || 'No repository linked yet'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRepoEditValue(project.gitRepo || '')
                      setIsEditingRepo(true)
                    }}
                    className="text-[10px] font-bold text-primary hover:underline flex-shrink-0 px-2 py-1 rounded-lg bg-white/80 border border-primary/10 shadow-xs cursor-pointer"
                  >
                    {project.gitRepo ? 'Edit Repo' : '+ Add Repo'}
                  </button>
                </div>
                
                <div>
                  <label htmlFor="update-content" className="label font-bold">What did you work on today? *</label>
                  <textarea
                    id="update-content"
                    className="input min-h-[100px] resize-none text-xs leading-relaxed"
                    placeholder="e.g. Completed backend database migrations and linked API routes..."
                    value={newUpdateContent}
                    onChange={(e) => setNewUpdateContent(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Completion Progress Score Selector */}
                <div className="bg-gray-50/80 border border-gray-150 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-text-primary flex items-center gap-1.5">
                      <span>Your Completion Progress:</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary text-white font-black text-xs shadow-2xs">
                      {newUpdateProgress}%
                    </span>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={newUpdateProgress}
                    onChange={(e) => setNewUpdateProgress(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />

                  {/* Preset Pills */}
                  <div className="flex gap-1.5 justify-between pt-1">
                    {[25, 50, 75, 90, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewUpdateProgress(val)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          newUpdateProgress === val
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-text-secondary border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsPosting(false); setNewUpdateContent(''); }}
                    className="flex-1 btn-secondary text-xs py-2.5 cursor-pointer"
                    disabled={isSubmittingUpdate}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
                    disabled={isSubmittingUpdate || !newUpdateContent.trim()}
                  >
                    {isSubmittingUpdate ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Post Update
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          )}

          {/* TAB 2: CHAT (Current Project Updates & Feedback) */}
          {modalTab === 'chat' && (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 animate-scale-in">
              {/* Simple Top Bar */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-text-primary">Project Messages ({updates.length})</span>
                <button
                  onClick={() => {
                    setModalTab('details')
                    setIsPosting(true)
                  }}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Post Update
                </button>
              </div>

              {/* Chat Feed */}
              {updates.length === 0 ? (
                <div className="text-center py-10 text-text-muted text-xs bg-gray-50/50 border border-dashed border-gray-200 rounded-xl space-y-1.5">
                  <MessageSquare className="w-6 h-6 text-gray-400 mx-auto" />
                  <p className="font-semibold text-text-secondary">No updates yet</p>
                  <p className="text-[10px] text-text-muted">Post your first update to start the thread.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map((upd) => (
                    <div key={upd.id} className="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-2.5">
                      {/* Author Header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs flex-shrink-0">
                            {upd.avatar}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary text-xs leading-tight">{upd.author}</p>
                            {upd.registerNumber && (
                              <p className="text-[10px] font-mono text-text-muted">{upd.registerNumber}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3 text-text-muted" />
                          {safeFormatDistance(upd.timestamp)}
                        </span>
                      </div>

                      {/* Student Message Body */}
                      <div className="bg-gray-50/80 p-3 rounded-xl text-xs text-text-secondary leading-relaxed border border-gray-150/70 font-medium">
                        {upd.content}
                      </div>

                      {/* Student Claimed / Completion Score */}
                      {upd.studentProgress !== null && upd.studentProgress !== undefined && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/90 border border-blue-200/70 text-[11px] font-bold text-blue-900">
                          <span className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold">Student Score:</span>
                          <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded font-black text-[10px]">
                            {upd.studentProgress}%
                          </span>
                        </div>
                      )}

                      {/* Admin Feedback Reply Box */}
                      {upd.progress !== null && upd.progress !== undefined ? (
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>PROGRESS SENT: {upd.progress}%</span>
                            </div>
                            {upd.reviewedAt && (
                              <span className="text-[10px] text-emerald-700/80">{safeFormatDistance(upd.reviewedAt)}</span>
                            )}
                          </div>

                          {upd.adminFeedback && (
                            <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-100 text-xs text-emerald-950 italic font-medium">
                              "{upd.adminFeedback}"
                            </div>
                          )}

                          <p className="text-[10px] text-emerald-800 font-medium">
                            Reviewed by: <strong className="font-bold text-emerald-950">{upd.reviewedBy || project.assignedBy || 'Admin'}</strong>
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium pt-0.5">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Awaiting progress reply</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* TAB 3: HISTORY (Past Projects) */}
          {modalTab === 'history' && (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 animate-scale-in">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">Past Project History</h3>
              {project.history && project.history.length > 0 ? (
                <div className="space-y-3">
                  {project.history.map((past, i) => (
                    <div key={past.id || i} className="bg-primary-light/10 border border-primary/10 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-primary bg-primary-light px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">
                          {past.teamId}
                        </span>
                        {past.assignedOn && (
                          <span className="text-[9px] text-text-muted font-bold font-mono">Assigned: {past.assignedOn}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-text-primary">{past.title}</h4>
                        <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{past.description}</p>
                      </div>
                      <div className="pt-2 border-t border-primary/5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-text-muted">
                        <span>Assigned By: <strong className="text-text-primary">{past.assignedBy}</strong></span>
                        <span>Members: <strong className="text-text-secondary">{past.members.join(', ')}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 bg-background/50 border border-dashed border-gray-150 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-primary-light/40 text-primary flex items-center justify-center mx-auto shadow-inner">
                    <History className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-text-primary">No Past Projects</p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                    This is your currently active project assignment. Prior project history will appear here whenever team re-assignments occur.
                  </p>
                </div>
              )}
            </div>
          )}

        </Modal>
      )}


      {/* Past Assigned Tasks Modal */}
      <Modal open={showPastTasksModal} onClose={() => setShowPastTasksModal(false)} title="Past Assignments" size="md">
        <div className="space-y-3">
          {assignedTasks.filter(t => t.status === 'COMPLETED').length === 0 ? (
            <div className="text-center py-6">
              <ClipboardList className="w-8 h-8 text-primary-light mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-primary">No completed tasks yet</p>
            </div>
          ) : (
            assignedTasks.filter(t => t.status === 'COMPLETED').map(task => (
              <div key={task.id} className="flex items-start gap-3 bg-background p-3 rounded-xl border border-gray-100">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-secondary line-through">
                    {task.title}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Assigned by {task.assignedBy} • Due {task.dueDate}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
