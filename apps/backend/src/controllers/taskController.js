const taskService = require("../services/taskService");
const { parseJSONBody, sendSuccess } = require("../utils/response");
const { handleError } = require("../middleware/errorMiddleware");
const { authenticate } = require("../middleware/authMiddleware");

const getTasks = async (req, res, queryParams = {}) => {
  try {
    const studentId = queryParams.student_id;
    let result;
    // Guard: treat missing, 'null', 'undefined', or non-numeric as "no filter"
    const isValidId = studentId && studentId !== 'null' && studentId !== 'undefined' && !isNaN(parseInt(studentId, 10));
    if (isValidId) {
      result = await taskService.getTasksByStudentId(studentId);
    } else {
      result = await taskService.getAllTasks();
    }
    return sendSuccess(res, 200, "Assigned tasks retrieved successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const createTask = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await parseJSONBody(req);
    
    // Automatically set the creator as assigned_by
    body.assigned_by = user.email;
    
    const result = await taskService.createTaskAssignment(body);
    return sendSuccess(res, 201, "Task assigned successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

const updateTaskStatus = async (req, res, id) => {
  try {
    const body = await parseJSONBody(req);
    const result = await taskService.updateTaskStatus(id, body.status);
    return sendSuccess(res, 200, "Task status updated successfully", result);
  } catch (err) {
    handleError(err, req, res);
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTaskStatus
};
