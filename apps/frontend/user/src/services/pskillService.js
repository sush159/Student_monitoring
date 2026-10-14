import { api, getStudentDbId } from './api'

export const pskillService = {
  getAll: async () => {
    const studentId = await getStudentDbId()
    if (!studentId) return []
    
    // 1. Fetch catalog of all P-Skills
    const catalogRes = await api.get('/p-skills')
    const catalog = Array.isArray(catalogRes.data) ? catalogRes.data : (catalogRes || [])
    
    // 2. Fetch student's assigned skills/completions
    const studentSkillsRes = await api.get(`/student-p-skills?student_id=${studentId}`)
    const studentSkills = Array.isArray(studentSkillsRes.data) ? studentSkillsRes.data : (studentSkillsRes || [])
    
    // 3. Map all catalog skills and cross-reference with student completions
    return catalog.map(skill => {
      const availableLevels = Array.isArray(skill.levels) ? skill.levels.map(l => 'Level ' + l) : ['Level 1']
      
      const completionsForSkill = studentSkills.filter(s => String(s.p_skill_id) === String(skill.id))
      const completedLevels = completionsForSkill.filter(s => s.completed).map(s => 'Level ' + s.level_code)
      
      const completion = availableLevels.length > 0 ? Math.round((completedLevels.length / availableLevels.length) * 100) : 0
      
      return {
        id: String(skill.id),
        name: skill.name,
        description: skill.description || `${skill.name} Skill`,
        category: 'Programming',
        completedLevels,
        availableLevels,
        completion,
        // Store completions so update() can reference database primary keys (id)
        completions: completionsForSkill
      }
    })
  },

  update: async (skillId, updates) => {
    const studentId = await getStudentDbId()
    
    // 1. Get all skills to find the one we are updating (with its raw completions list)
    const allSkills = await pskillService.getAll()
    const skill = allSkills.find(s => s.id === skillId)
    if (!skill) throw new Error('Skill not found in catalog')

    const newCompletedList = updates.completedLevels || []

    // 2. For each available level, check if we should insert a new record or update an existing one
    for (const lvlStr of skill.availableLevels) {
      const levelCode = lvlStr.replace('Level ', '')
      const shouldBeCompleted = newCompletedList.includes(lvlStr)
      
      // Check if we have an existing DB record for this specific level
      const existing = skill.completions.find(c => String(c.level_code) === String(levelCode))
      
      if (existing) {
        // If the state changed, update it
        const currentCompletedState = !!existing.completed
        if (currentCompletedState !== shouldBeCompleted) {
          await api.put(`/student-p-skills/${existing.id}`, {
            status: shouldBeCompleted ? 'COMPLETED' : 'INCOMPLETE'
          })
        }
      } else {
        // If it does not exist in DB yet and is selected, create it as completed
        if (shouldBeCompleted) {
          await api.post('/student-p-skills', {
            student_id: studentId,
            pskill_id: skillId,
            level: levelCode,
            status: 'COMPLETED'
          })
        }
      }
    }

    // 3. Fetch and return the updated skill object
    const refreshedSkills = await pskillService.getAll()
    return refreshedSkills.find(s => s.id === skillId)
  },
}
