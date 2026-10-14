const teamService = require("../services/teamService");
const teamRepository = require("../repositories/teamRepository");
const { parseJSONBody, sendSuccess } = require("../utils/response");
const { handleError } = require("../middleware/errorMiddleware");
const { authenticate } = require("../middleware/authMiddleware");

const getTeamByStudentId = async (req, res, studentId) => {
  try {
    // Guard: reject non-numeric or missing studentId before hitting DB
    if (!studentId || isNaN(parseInt(studentId, 10))) {
      const { sendError } = require("../utils/response");
      return sendError(res, 400, "Invalid student ID", "VALIDATION_ERROR");
    }
    const result = await teamService.getTeamByStudentId(studentId);
    return sendSuccess(res, 200, "Student team retrieved successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const getTeamById = async (req, res, id) => {
  try {
    const result = await teamService.getTeamById(id);
    return sendSuccess(res, 200, "Team retrieved successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const getAllTeams = async (req, res) => {
  try {
    const result = await teamService.getAllTeams();
    return sendSuccess(res, 200, "All teams retrieved successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const createTeam = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await parseJSONBody(req);
    body.assigned_by = user.email;
    const result = await teamService.createTeam(body);
    return sendSuccess(res, 201, "Team created successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const addTeamMember = async (req, res, teamId) => {
  try {
    const body = await parseJSONBody(req);
    const result = await teamService.addTeamMember(teamId, body.student_id);
    return sendSuccess(res, 200, "Team member added successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const removeTeamMember = async (req, res, teamId, studentId) => {
  try {
    const result = await teamService.removeTeamMember(teamId, studentId);
    return sendSuccess(res, 200, "Team member removed successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const getProjectUpdates = async (req, res, queryParams = {}) => {
  try {
    const user = authenticate(req);
    const teamId = queryParams.team_id || queryParams.teamId || null;
    let result = await teamService.getProjectUpdates(teamId);

    // Apply visibility filtering:
    // Students only see their own team's updates
    if (user.role === "STUDENT") {
      const studentTeam = await teamRepository.findTeamByStudentId(user.student_id);
      if (!studentTeam) {
        result = [];
      } else {
        result = result.filter(u => String(u.team_id) === String(studentTeam.id));
      }
    } else if (user.role === "ADMIN" && !teamId) {
      const allTeams = await teamRepository.findAllTeams();
      const myTeams = allTeams.filter(t => 
        t.assigned_by && user.email && 
        (t.assigned_by.toLowerCase() === user.email.toLowerCase() || t.assigned_by.toLowerCase().includes(user.email.toLowerCase()))
      );
      if (myTeams.length > 0) {
        const myTeamIds = new Set(myTeams.map(t => String(t.id)));
        result = result.filter(u => myTeamIds.has(String(u.team_id)));
      }
    }

    return sendSuccess(res, 200, "Project updates retrieved successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const createProjectUpdate = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await parseJSONBody(req);
    
    if (user.role === "STUDENT") {
      body.student_id = user.student_id;
    }
    
    const result = await teamService.createProjectUpdate(body);
    return sendSuccess(res, 201, "Project update created successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const updateProjectProgress = async (req, res, updateId) => {
  try {
    const user = authenticate(req);
    const body = await parseJSONBody(req);
    body.reviewed_by = user.email || user.name || "Admin";
    const result = await teamService.updateProjectProgress(updateId, body);
    return sendSuccess(res, 200, "Project progress updated successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const updateTeamProgress = async (req, res, teamId) => {
  try {
    authenticate(req);
    const body = await parseJSONBody(req);
    const result = await teamService.updateTeamProgress(teamId, body.progress);
    return sendSuccess(res, 200, "Team progress updated successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const updateTeamRepo = async (req, res, teamId) => {
  try {
    authenticate(req);
    const body = await parseJSONBody(req);
    const result = await teamService.updateTeamRepo(teamId, body.git_repo);
    return sendSuccess(res, 200, "Team git repo updated successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const updateTeamStatus = async (req, res, teamId) => {
  try {
    authenticate(req);
    const body = await parseJSONBody(req);
    const status = body.status || 'COMPLETED';
    const result = await teamService.updateTeamStatus(teamId, status);
    return sendSuccess(res, 200, `Team status updated to ${status} successfully`, result);
  } catch (err) {
    handleError(err, req, res);
  }
};

module.exports = {
  getTeamByStudentId,
  getTeamById,
  getAllTeams,
  createTeam,
  updateTeamRepo,
  updateTeamProgress,
  updateTeamStatus,
  addTeamMember,
  removeTeamMember,
  getProjectUpdates,
  createProjectUpdate,
  updateProjectProgress
};


