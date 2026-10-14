import React, { useState, useEffect, useRef } from 'react'
import { 
  format, parseISO, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameMonth, isSameDay, subMonths, addMonths 
} from 'date-fns'
import { 
  Calendar as CalendarIcon, Clock, 
  MapPin, ChevronLeft, ChevronRight, ChevronDown, Search 
} from 'lucide-react'
import { attendanceService } from '../services/attendanceService'
import { movementService } from '../services/movementService'

// 7 Standard Academic Slots
const HOURLY_SLOTS = [
  { id: 1, startTime: '08:45 AM', endTime: '09:35 AM', session: 'Forenoon' },
  { id: 2, startTime: '09:35 AM', endTime: '10:25 AM', session: 'Forenoon' },
  { id: 3, startTime: '10:40 AM', endTime: '11:30 AM', session: 'Forenoon' },
  { id: 4, startTime: '11:30 AM', endTime: '12:20 PM', session: 'Forenoon' },
  { id: 5, startTime: '01:30 PM', endTime: '02:20 PM', session: 'Afternoon' },
  { id: 6, startTime: '02:20 PM', endTime: '03:10 PM', session: 'Afternoon' },
  { id: 7, startTime: '03:25 PM', endTime: '04:25 PM', session: 'Afternoon' }
]

export default function Attendance() {
  const [records, setRecords] = useState([])
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Calendar states
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)

  // Search & Month filters states
  const [searchQuery, setSearchQuery] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])

  // Hourly Log Filter state ('ALL', 'PRESENT', 'ABSENT', 'PASS')
  const [filter, setFilter] = useState('ALL')

  const calendarRef = useRef(null)

  useEffect(() => {
    Promise.all([
      attendanceService.getAll(),
      movementService.getAll()
    ]).then(([recs, passList]) => {
      setRecords(recs)
      setPasses(passList)
      
      // Calculate available months from records
      if (recs.length > 0) {
        const sortedRecs = [...recs].sort((a, b) => b.date.localeCompare(a.date))
        const latestRecordDate = parseISO(sortedRecs[0].date)
        setSelectedDate(latestRecordDate)
        setCurrentMonth(latestRecordDate)

        const uniqueMonths = Array.from(new Set(recs.map(r => 
          format(parseISO(r.date), 'MMMM yyyy')
        ))).sort((a, b) => new Date(b) - new Date(a))
        setAvailableMonths(uniqueMonths)
      }
    })
    .catch(err => {
      console.error('Failed to load attendance data:', err)
    })
    .finally(() => {
      setLoading(false)
    })
  }, [])

  // Handle outside click to close calendar dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Parse time to minutes from midnight for mathematical overlap calculations.
  // Accepts "hh:mm AM/PM", "hh AM/PM", or bare 24h "HH:MM" / "HH:MM:SS" strings.
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0
    const clean = timeStr.trim().toLowerCase().replace(/\./g, ':')

    // 12-hour with minutes: "11:15 am", "01:30 pm"
    const m12 = clean.match(/(\d+):(\d+)\s*(am|pm)/)
    if (m12) {
      let h = parseInt(m12[1]), m = parseInt(m12[2])
      const ap = m12[3]
      if (ap === 'pm' && h < 12) h += 12
      if (ap === 'am' && h === 12) h = 0
      return h * 60 + m
    }
    // 12-hour without minutes: "11 am"
    const m12s = clean.match(/(\d+)\s*(am|pm)/)
    if (m12s) {
      let h = parseInt(m12s[1])
      const ap = m12s[2]
      if (ap === 'pm' && h < 12) h += 12
      if (ap === 'am' && h === 12) h = 0
      return h * 60
    }
    // 24-hour with optional seconds: "13:30:00" or "13:30"
    const m24 = clean.match(/^(\d{1,2}):(\d{2})/)
    if (m24) {
      return parseInt(m24[1]) * 60 + parseInt(m24[2])
    }
    return 0
  }

  // Format minutes-from-midnight back to "hh:mm AM/PM"
  const minutesToAmPm = (totalMin) => {
    const h24 = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const ap = h24 >= 12 ? 'PM' : 'AM'
    let h12 = h24 % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`
  }

  // Parse a pass's "timing" string ("hh:mm AM - hh:mm PM") into [startMin, endMin].
  // Returns null if it cannot be parsed.
  const parsePassTimingRange = (timingStr) => {
    if (!timingStr) return null
    const parts = timingStr.replace(/–/g, '-').replace(/\s+to\s+/gi, ' - ').split('-')
    if (parts.length < 2) return null
    const s = parseTimeToMinutes(parts[0])
    const e = parseTimeToMinutes(parts[1])
    if (s === 0 && e === 0) return null
    return [s, e]
  }

  // Compute overlap info between a pass and a slot period.
  // Returns: { overlaps, overlapStart, overlapEnd, overlapMinutes, isPartial, fullDuration }
  // or null when there is no overlap at all.
  const computeOverlap = (pass, slotStartStr, slotEndStr) => {
    const passRange = parsePassTimingRange(pass.timing)
    if (!passRange) return null
    const [passStart, passEnd] = passRange
    const slotStart = parseTimeToMinutes(slotStartStr)
    const slotEnd = parseTimeToMinutes(slotEndStr)

    const overlapStart = Math.max(passStart, slotStart)
    const overlapEnd = Math.min(passEnd, slotEnd)

    if (overlapStart >= overlapEnd) return null  // no real overlap

    const overlapMinutes = overlapEnd - overlapStart
    const fullDuration = passEnd - passStart
    const isPartial = overlapMinutes < fullDuration

    return {
      overlaps: true,
      overlapStart: minutesToAmPm(overlapStart),
      overlapEnd: minutesToAmPm(overlapEnd),
      overlapMinutes,
      fullDuration,
      isPartial,
    }
  }

  // Thin wrapper — returns { pass, overlap } or null (replaces old getOverlappingPass)
  const getOverlappingPassWithInfo = (pass, slotStartStr, slotEndStr) => {
    const overlap = computeOverlap(pass, slotStartStr, slotEndStr)
    if (!overlap) return null
    return { pass, overlap }
  }

  // Lookup attendance session statuses for a specific date
  const getDateStatus = (date) => {
    const formattedDate = format(date, 'yyyy-MM-dd')
    const recs = records.filter(r => r.date === formattedDate)
    const forenoon = recs.find(r => r.session.toLowerCase().includes('forenoon'))?.status
    const afternoon = recs.find(r => r.session.toLowerCase().includes('afternoon'))?.status
    return { forenoon, afternoon }
  }

  // Month navigation handlers
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // Handle Month dropdown select
  const handleMonthFilterChange = (e) => {
    const val = e.target.value
    if (!val) return
    const match = records.find(r => format(parseISO(r.date), 'MMMM yyyy') === val)
    if (match) {
      const parsedDate = parseISO(match.date)
      setSelectedDate(parsedDate)
      setCurrentMonth(parsedDate)
    }
  }

  // Handle Search Input change
  const handleSearchChange = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    if (!query.trim()) return

    const q = query.toLowerCase()
    const match = records.find(r => {
      const parsed = parseISO(r.date)
      const formatted = format(parsed, 'dd MMM yyyy').toLowerCase()
      const formattedSimple = format(parsed, 'd MMM').toLowerCase()
      return formatted.includes(q) || formattedSimple.includes(q) || r.date.includes(q)
    })
    if (match) {
      const parsedDate = parseISO(match.date)
      setSelectedDate(parsedDate)
      setCurrentMonth(parsedDate)
    }
  }

  // Render Calendar Grid Days in Dropdown
  const renderCalendarDropdown = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    return (
      <div className="absolute left-0 mt-2 w-72 bg-white border border-gray-150 rounded-xl shadow-modal p-4 z-50 animate-scale-in">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-gray-150 rounded-lg text-text-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={handleNextMonth} 
              className="p-1 hover:bg-gray-150 rounded-lg text-text-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekdays Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekdays.map(d => (
            <span key={d} className="text-[10px] font-bold text-text-muted uppercase tracking-wider py-1">{d}</span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const isSameMonthDay = isSameMonth(day, currentMonth)
            const isSelected = isSameDay(day, selectedDate)
            const { forenoon, afternoon } = getDateStatus(day)
            const hasAbsence = forenoon === 'ABSENT' || afternoon === 'ABSENT'
            const hasPresence = forenoon === 'PRESENT' || afternoon === 'PRESENT'

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedDate(day)
                  setShowCalendar(false)
                }}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-semibold relative transition-all duration-150 ${
                  !isSameMonthDay ? 'text-text-muted opacity-40 hover:bg-gray-50' : 
                  isSelected ? 'bg-primary text-white font-extrabold shadow-sm' : 
                  'text-text-primary hover:bg-primary-light/50'
                }`}
              >
                <span>{format(day, 'd')}</span>
                {/* Visual indicator dot under date */}
                {isSameMonthDay && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {hasAbsence && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-danger'}`} />}
                    {hasPresence && !hasAbsence && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-success'}`} />}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Render period boxes for selected date
  const renderHourlySlots = () => {
    const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd')
    const { forenoon, afternoon } = getDateStatus(selectedDate)
    const datePasses = passes.filter(p => p.date === formattedSelectedDate)

    const filteredSlots = HOURLY_SLOTS.filter(slot => {
      let hasPass = false
      for (let pass of datePasses) {
        if (getOverlappingPassWithInfo(pass, slot.startTime, slot.endTime)) { hasPass = true; break }
      }
      const isSessionPresent = slot.session === 'Forenoon' ? forenoon === 'PRESENT' : afternoon === 'PRESENT'
      const isAbsent = !isSessionPresent && !hasPass
      if (filter === 'PRESENT') return !isAbsent
      if (filter === 'ABSENT') return isAbsent
      if (filter === 'PASS') return hasPass
      return true
    })

    return (
      <div className="space-y-2">
        {filteredSlots.length === 0 ? (
          <div className="text-center text-xs font-bold text-text-muted italic py-10">
            No records matching "{filter.toLowerCase()}" filter
          </div>
        ) : (
          filteredSlots.map((slot, idx) => {
            // ── Find overlapping pass ────────────────────────────────────
            let matchedPassInfo = null
            for (let pass of datePasses) {
              const info = getOverlappingPassWithInfo(pass, slot.startTime, slot.endTime)
              if (info) { matchedPassInfo = info; break }
            }
            const matchedPass = matchedPassInfo?.pass ?? null
            const overlapInfo = matchedPassInfo?.overlap ?? null

            const isSessionPresent = slot.session === 'Forenoon' ? forenoon === 'PRESENT' : afternoon === 'PRESENT'
            const isAbsent = !isSessionPresent && !matchedPass
            const hasPass = !!matchedPass

            // ── Proportional Pass Zone Position & Width (0–100%) ─────────
            // leftOffsetPct  = where the pass begins in the slot timeline
            // rightOffsetPct = how far from the end of the slot it finishes
            // passWidthPct   = exact percentage of the period covered by the pass
            let leftOffsetPct  = 0
            let rightOffsetPct = 0
            let passWidthPct   = 0


            if (matchedPass && overlapInfo) {
              const slotStartMin    = parseTimeToMinutes(slot.startTime)
              const slotEndMin      = parseTimeToMinutes(slot.endTime)
              const slotDurationMin = slotEndMin - slotStartMin
              const passRange       = parsePassTimingRange(matchedPass.timing)
              if (passRange && slotDurationMin > 0) {
                const [passStartMin, passEndMin] = passRange
                const clampedStart = Math.max(slotStartMin, passStartMin)
                const clampedEnd   = Math.min(slotEndMin, passEndMin)
                leftOffsetPct  = Math.max(0, Math.min(100, ((clampedStart - slotStartMin) / slotDurationMin) * 100))
                rightOffsetPct = Math.max(0, Math.min(100, ((slotEndMin - clampedEnd) / slotDurationMin) * 100))
                passWidthPct   = Math.max(0, Math.min(100, 100 - leftOffsetPct - rightOffsetPct))
              }
            }

            // ── Colors ──────────────────────────────────────────────────
            const boxBg      = isAbsent ? 'rgba(254,202,202,0.50)' : 'rgba(220,252,231,0.50)'
            const boxBorder  = isAbsent ? 'rgba(252,165,165,0.75)' : 'rgba(134,239,172,0.75)'
            const statusColor   = isAbsent ? '#dc2626' : '#16a34a'
            const statusBadgeBg = isAbsent ? 'rgba(254,202,202,0.95)' : 'rgba(187,247,208,0.95)'
            const statusLabel   = isAbsent ? 'Absent' : hasPass ? 'Pass' : 'Present'
            const slotNum       = `S${idx + 1}`

            return (
              <div
                key={slot.id}
                className="relative flex items-stretch rounded-2xl overflow-hidden transition-all shadow-xs"
                style={{
                  background: boxBg,
                  border: `1.5px solid ${boxBorder}`,
                  minHeight: '66px',
                }}
              >
                {/* ════════════════════════════════════════════════════════
                    LEFT: Slot & Session Info Panel (Dedicated, non-overlapping)
                ════════════════════════════════════════════════════════ */}
                <div className="w-44 sm:w-48 flex-shrink-0 flex items-center gap-3 px-3.5 py-3 bg-white/80 backdrop-blur-xs border-r border-black/5 z-20">
                  {/* Slot pill */}
                  <div
                    className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black shadow-2xs"
                    style={{ background: 'rgba(255,255,255,0.95)', color: statusColor, border: `1px solid ${boxBorder}` }}
                  >
                    {slotNum}
                  </div>

                  {/* Text block */}
                  <div className="min-w-0">
                    <p className="text-xs font-black text-text-primary leading-tight">
                      {slot.startTime} – {slot.endTime}
                    </p>
                    <p className="text-[9px] text-text-muted font-bold mt-0.5 leading-none uppercase tracking-wider">
                      {slot.session}
                    </p>
                  </div>
                </div>

                {/* ════════════════════════════════════════════════════════
                    RIGHT: Timeline & Status Area (Full Height)
                ════════════════════════════════════════════════════════ */}
                <div className="flex-1 relative flex items-stretch min-w-0 overflow-hidden">
                  {/* PROPORTIONAL COLORED PASS BLOCK (Full row height) */}
                  {hasPass && overlapInfo && passWidthPct > 0 ? (
                    <div
                      className="absolute top-0 bottom-0 z-10 flex items-center justify-between px-3.5 overflow-hidden animate-fade-in transition-all"
                      title={`${matchedPass.movementType || 'Movement Pass'} (${overlapInfo.overlapStart} – ${overlapInfo.overlapEnd}, ${overlapInfo.overlapMinutes} mins)${matchedPass.reason ? ` - ${matchedPass.reason}` : ''}`}
                      style={{
                        left: `${leftOffsetPct}%`,
                        width: `${Math.min(100 - leftOffsetPct, Math.max(20, passWidthPct))}%`,
                        background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(253, 230, 138, 0.95) 100%)',
                        borderLeft: leftOffsetPct > 0.5 ? '1.5px dashed rgba(217, 119, 6, 0.60)' : 'none',
                        borderRight: rightOffsetPct > 0.5 ? '1.5px dashed rgba(217, 119, 6, 0.60)' : 'none',
                      }}
                    >
                      {/* Pass Details */}
                      <div className="min-w-0 pr-2 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MapPin className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                          <span className="text-[11px] font-black text-amber-950 truncate">
                            {matchedPass.movementType || 'Pass'}
                          </span>
                          <span className="text-[9px] font-bold text-amber-800 font-mono whitespace-nowrap">
                            ({overlapInfo.overlapStart} – {overlapInfo.overlapEnd})
                          </span>
                        </div>
                        {matchedPass.reason && (
                          <p className="text-[9px] font-semibold text-amber-900/90 truncate mt-0.5 leading-tight">
                            {matchedPass.reason}
                          </p>
                        )}
                      </div>

                      {/* Pass Badge */}
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-300/90 text-amber-950 uppercase tracking-wider border border-amber-400/60 shadow-2xs flex-shrink-0">
                        PASS
                      </span>
                    </div>
                  ) : (
                    /* PRESENT / ABSENT BADGE (when no pass present) */
                    <div className="flex-1 flex items-center justify-end pr-4 z-10">
                      <span
                        className="text-[9px] font-black rounded-full px-3 py-1 uppercase tracking-wider shadow-2xs flex-shrink-0"
                        style={{ background: statusBadgeBg, color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }








  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-text-primary tracking-tight">My Attendance</h1>
        <p className="text-xs text-text-secondary mt-0.5">View hourly logs and pass activity records</p>
      </div>

      {/* Control Bar: Search, Month Filter, Date Selector & Log Filter Options */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search date (e.g. 15 Aug)..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-gray-150 rounded-xl focus:border-primary/50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all outline-none font-semibold text-text-primary"
          />
        </div>

        {/* Month Dropdown Selector */}
        {availableMonths.length > 0 && (
          <select
            value={format(currentMonth, 'MMMM yyyy')}
            onChange={handleMonthFilterChange}
            className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary/30 cursor-pointer min-w-[130px] font-bold text-text-primary"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* Date Selector Trigger */}
        <div ref={calendarRef} className="relative">
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:border-primary/30 transition-all text-xs font-bold text-text-primary shadow-xs cursor-pointer focus:outline-none"
          >
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>{format(selectedDate, 'dd MMM yyyy')}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>
          {showCalendar && renderCalendarDropdown()}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-50 rounded-xl border border-gray-200/50">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PRESENT', label: 'Present' },
            { id: 'ABSENT', label: 'Absent' },
            { id: 'PASS', label: 'Pass' }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                filter === opt.id
                  ? 'bg-white text-primary shadow-xs border border-gray-100'
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs section (All slots visible on a single page in vertical timeline) */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-primary" /> Logs for {format(selectedDate, 'EEEE, d MMM')}
        </h2>
        {renderHourlySlots()}
      </div>
    </div>
  )
}
