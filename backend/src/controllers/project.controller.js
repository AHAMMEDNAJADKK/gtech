import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import ProjectCategory from '../models/projectCategory.model.js';
import Client from '../models/client.model.js';
import Task from '../models/task.model.js';
import ProjectActivity from '../models/projectActivity.model.js';
import ProjectMilestone from '../models/projectMilestone.model.js';
import ProjectComment from '../models/projectComment.model.js';
import ProjectDocument from '../models/projectDocument.model.js';
import User from '../models/user.model.js';
import { validationResult } from 'express-validator';
import { generateProjectCode, notifyProjectEvent } from '../services/project.service.js';
import { sendSuccess, sendError } from '../utils/response.helper.js';

export const getProjects = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      client,
      priority,
      projectManager,
      assignedEmployee,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { projectName: { $regex: search, $options: 'i' } },
        { projectCode: { $regex: search, $options: 'i' } },
        { technologyStack: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (status) query.status = status;
    if (client && mongoose.Types.ObjectId.isValid(client)) query.client = client;
    if (priority) query.priority = priority;
    if (projectManager && mongoose.Types.ObjectId.isValid(projectManager)) query.projectManager = projectManager;
    if (assignedEmployee && mongoose.Types.ObjectId.isValid(assignedEmployee)) query.assignedEmployees = assignedEmployee;


    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const projects = await Project.find(query)
      .populate('client', 'companyName clientName clientId companyLogo email')
      .populate('projectManager', 'name email avatar employeeId designation')
      .populate('assignedTeamLead', 'name email avatar employeeId designation')
      .populate('assignedEmployees', 'name email avatar employeeId role designation department')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .exec();

    // Dynamically recalculate & sync progress percentage from assigned tasks
    const Task = (await import('../models/task.model.js')).default;
    for (let proj of projects) {
      const projIdStr = proj._id.toString();
      let queryIdList = [projIdStr];
      if (mongoose.Types.ObjectId.isValid(projIdStr)) {
        queryIdList.push(new mongoose.Types.ObjectId(projIdStr));
      }
      const projTasks = await Task.find({ project: { $in: queryIdList } });
      if (projTasks.length > 0) {
        const doneTasks = projTasks.filter(t => ['done', 'Completed', 'completed', 'Done', 'DONE'].includes(t.status)).length;
        const computedProgress = Math.round((doneTasks / projTasks.length) * 100);
        if (proj.progress !== computedProgress) {
          proj.progress = computedProgress;
          await Project.findByIdAndUpdate(proj._id, { progress: computedProgress });
        }
      }
    }

    const total = await Project.countDocuments(query);

    // Compute status stats for analytics headers
    const statusCounts = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statsMap = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return sendSuccess(res, 'Projects retrieved successfully', {
      projects,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      },
      stats: {
        totalProjects: total,
        planning: statsMap['Planning'] || 0,
        development: statsMap['Development'] || 0,
        testing: statsMap['Testing'] || 0,
        completed: statsMap['Completed'] || 0
      }
    });
  } catch (error) {
    console.error('getProjects Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid project ID', 400);
    }

    const project = await Project.findById(id)
      .populate('client', 'companyName clientName clientId companyLogo email phone industry website')
      .populate('projectManager', 'name email avatar employeeId phone designation department')
      .populate('assignedTeamLead', 'name email avatar employeeId phone designation department')
      .populate('assignedEmployees', 'name email avatar employeeId phone designation department role')
      .populate('teamStructure.designer', 'name email avatar designation')
      .populate('teamStructure.developer', 'name email avatar designation')
      .populate('teamStructure.qa', 'name email avatar designation')
      .populate('teamStructure.marketing', 'name email avatar designation')
      .populate('teamStructure.operations', 'name email avatar designation')
      .populate('teamStructure.hrCoordinator', 'name email avatar designation')
      .populate('createdBy', 'name email')
      .exec();

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    const milestones = await ProjectMilestone.find({ project: id }).sort({ dueDate: 1 });
    const activities = await ProjectActivity.find({ project: id }).populate('user', 'name email avatar').sort({ createdAt: -1 }).limit(25);
    const comments = await ProjectComment.find({ project: id }).populate('author', 'name email avatar role').sort({ createdAt: -1 });
    const documents = await ProjectDocument.find({ project: id }).populate('uploadedBy', 'name email').sort({ createdAt: -1 });
    let queryIdList = [id];
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryIdList.push(new mongoose.Types.ObjectId(id));
    }
    const tasks = await Task.find({ project: { $in: queryIdList } }).populate('assigned_to', 'name email avatar').sort({ createdAt: -1 });

    // Calculate dynamic progress from tasks
    if (tasks.length > 0) {
      const completedTasksCount = tasks.filter(t => ['done', 'Completed', 'completed', 'Done', 'DONE'].includes(t.status)).length;
      const computedProgress = Math.round((completedTasksCount / tasks.length) * 100);
      if (project.progress !== computedProgress) {
        project.progress = computedProgress;
        await Project.findByIdAndUpdate(id, { progress: computedProgress });
      }
    }

    return sendSuccess(res, 'Project details retrieved successfully', {
      project,
      milestones,
      activities,
      comments,
      documents,
      tasks
    });
  } catch (error) {
    console.error('getProjectById Error:', error);
    return sendError(res, error.message, 500);
  }
};

const sanitizeProjectPayload = (body) => {
  const sanitized = { ...body };
  if (Object.prototype.hasOwnProperty.call(sanitized, 'deadline')) {
    sanitized.deadline = sanitized.deadline ? sanitized.deadline : null;
  }
  return sanitized;
};

const assertCategoryBelongsToDepartment = async (departmentId, categoryName) => {
  const name = String(categoryName || '').trim();
  if (!name) return { ok: true };

  if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
    return { ok: false, message: 'Please select a department before choosing a project category' };
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const category = await ProjectCategory.findOne({
    departmentId,
    name: { $regex: new RegExp(`^${escaped}$`, 'i') }
  });

  if (!category) {
    return { ok: false, message: 'Selected category does not belong to the chosen department' };
  }

  return { ok: true, name: category.name };
};

export const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array()[0].msg, 400);
    }

    const { assignedEmployees } = req.body;

    if (!Array.isArray(assignedEmployees) || assignedEmployees.length === 0) {
      return sendError(res, 'Assigned Employees field is mandatory and must contain at least one employee', 400);
    }

    const clientObj = await Client.findById(req.body.client);
    if (!clientObj) {
      return sendError(res, 'Selected Client does not exist', 400);
    }

    let deptId = req.body.departmentId || null;
    let deptName = req.body.department || '';

    if (deptId && !deptName) {
      try {
        const Department = (await import('../models/department.model.js')).default;
        const dObj = await Department.findById(deptId);
        if (dObj) deptName = dObj.name || dObj.department_name || '';
      } catch (e) {}
    }

    if (!deptId && !deptName && req.body.projectManager) {
      const pmUser = await User.findById(req.body.projectManager);
      if (pmUser) {
        deptId = pmUser.departmentId || null;
        deptName = pmUser.department || '';
      }
    }

    const projectCode = await generateProjectCode();

    const sanitized = sanitizeProjectPayload(req.body);

    const newProject = new Project({
      ...sanitized,
      departmentId: (deptId && mongoose.Types.ObjectId.isValid(deptId)) ? new mongoose.Types.ObjectId(deptId) : null,
      department: deptName,
      projectCode,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    await newProject.save();

    await ProjectActivity.create({
      project: newProject._id,
      client: newProject.client,
      user: req.user.id,
      action: 'PROJECT_CREATED',
      title: `Project Initialized: ${newProject.projectName}`,
      description: `Project code ${projectCode} assigned with ${assignedEmployees.length} active employees`
    });

    const populatedProject = await Project.findById(newProject._id)
      .populate('client', 'companyName clientName')
      .populate('projectManager', 'name email avatar')
      .populate('assignedEmployees', 'name email avatar');

    await notifyProjectEvent({
      project: populatedProject,
      eventType: 'PROJECT_CREATED',
      triggeredBy: req.user.id,
      message: `Project ${populatedProject.projectName} (${projectCode}) has been created and assigned to you.`
    });

    return sendSuccess(res, 'Project created successfully', populatedProject, 201);
  } catch (error) {
    console.error('createProject Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return sendError(res, 'Project not found', 404);
    }

    const sanitizedUpdate = sanitizeProjectPayload(req.body);

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      {
        ...sanitizedUpdate,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    )
      .populate('client', 'companyName clientName')
      .populate('projectManager', 'name email avatar')
      .populate('assignedTeamLead', 'name email avatar')
      .populate('assignedEmployees', 'name email avatar role');

    // Notify if status changed
    if (req.body.status && req.body.status !== existingProject.status) {
      await ProjectActivity.create({
        project: id,
        client: updatedProject.client._id,
        user: req.user.id,
        action: 'STATUS_CHANGED',
        title: `Status Changed: ${existingProject.status} ➔ ${req.body.status}`,
        description: `Project workflow updated to ${req.body.status}`
      });

      await notifyProjectEvent({
        project: updatedProject,
        eventType: 'STATUS_CHANGED',
        triggeredBy: req.user.id,
        message: `Project ${updatedProject.projectName} status changed from ${existingProject.status} to ${req.body.status}`
      });
    }

    return sendSuccess(res, 'Project updated successfully', updatedProject);
  } catch (error) {
    console.error('updateProject Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    const oldStatus = project.status;
    project.status = status || project.status;
    if (typeof progress === 'number') project.progress = progress;
    project.updatedBy = req.user.id;

    await project.save();

    await ProjectActivity.create({
      project: id,
      user: req.user.id,
      action: 'STATUS_CHANGED',
      title: `Workflow Stage Transition: ${oldStatus} ➔ ${project.status}`,
      description: `Progress updated to ${project.progress}%`
    });

    const populatedProject = await Project.findById(id)
      .populate('projectManager', 'name email')
      .populate('assignedEmployees', 'name email');

    await notifyProjectEvent({
      project: populatedProject,
      eventType: 'STATUS_CHANGED',
      triggeredBy: req.user.id,
      message: `Project ${project.projectName} moved to workflow stage '${project.status}' (${project.progress}% complete)`
    });

    return sendSuccess(res, 'Project status updated successfully', project);
  } catch (error) {
    console.error('updateProjectStatus Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const assignWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedEmployees, teamStructure } = req.body;

    if (!Array.isArray(assignedEmployees) || assignedEmployees.length === 0) {
      return sendError(res, 'Assigned Employees list cannot be empty', 400);
    }

    const project = await Project.findById(id);
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    project.assignedEmployees = assignedEmployees;
    if (teamStructure) project.teamStructure = { ...project.teamStructure, ...teamStructure };
    project.updatedBy = req.user.id;

    await project.save();

    await ProjectActivity.create({
      project: id,
      user: req.user.id,
      action: 'WORK_REASSIGNED',
      title: `Team Reallocation Triggered`,
      description: `Project team updated with ${assignedEmployees.length} members`
    });

    const populatedProject = await Project.findById(id)
      .populate('assignedEmployees', 'name email avatar role');

    await notifyProjectEvent({
      project: populatedProject,
      eventType: 'EMPLOYEE_ASSIGNED',
      triggeredBy: req.user.id,
      message: `Team assignments updated for Project ${project.projectName}`
    });

    return sendSuccess(res, 'Project team assignments updated successfully', populatedProject);
  } catch (error) {
    console.error('assignWork Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getVisibleWork = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate('assignedEmployees', 'name email avatar employeeId designation department role')
      .populate('projectManager', 'name email avatar')
      .populate('assignedTeamLead', 'name email avatar');

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    const tasks = await Task.find({ project: id })
      .populate('assignedTo', 'name email avatar employeeId designation')
      .sort({ createdAt: -1 });

    const comments = await ProjectComment.find({ project: id })
      .populate('author', 'name email avatar role')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Visible work retrieved successfully', {
      project,
      tasks,
      comments
    });
  } catch (error) {
    console.error('getVisibleWork Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getProjectReports = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const overdueProjects = await Project.countDocuments({
      status: { $ne: 'Completed' },
      deadline: { $lt: new Date() }
    });

    const budgetStats = await Project.aggregate([
      { $group: { _id: null, totalBudget: { $sum: '$estimatedBudget' }, avgBudget: { $avg: '$estimatedBudget' } } }
    ]);

    const categoryDistribution = await Project.aggregate([
      { $group: { _id: '$projectCategory', count: { $sum: 1 } } }
    ]);

    return sendSuccess(res, 'Project reports compiled successfully', {
      totalProjects,
      completedProjects,
      overdueProjects,
      totalBudget: budgetStats[0]?.totalBudget || 0,
      avgBudget: budgetStats[0]?.avgBudget || 0,
      categoryDistribution
    });
  } catch (error) {
    console.error('getProjectReports Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByIdAndDelete(id);

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    return sendSuccess(res, 'Project deleted successfully', { id });
  } catch (error) {
    console.error('deleteProject Error:', error);
    return sendError(res, error.message, 500);
  }
};
