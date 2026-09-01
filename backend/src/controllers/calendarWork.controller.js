import mongoose from 'mongoose';
import path from 'path';
import CalendarWork from '../models/calendarWork.model.js';
import User from '../models/user.model.js';
import Project from '../models/project.model.js';
import Client from '../models/client.model.js';
import Task from '../models/task.model.js';
import Department from '../modules/departments/department.model.js';
import { sendSuccess, sendError } from '../utils/response.helper.js';
import logger from '../utils/logger.util.js';
import { notifyContentAssignedAndTeamLead, checkAndNotifyPostingDateDue } from '../services/calendarNotification.service.js';

// ============================================================
// HELPERS
// ============================================================

const getAuthUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId;
};

const isValidObjectId = (value) => {
  if (!value) return false;
  return mongoose.Types.ObjectId.isValid(String(value).trim());
};

const parseValidDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
};

const formatHHMM = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    if (/^\d{2}$/.test(hh) && /^\d{2}$/.test(mm)) {
      return `${hh}:${mm}`;
    }
  }
  return '';
};

const isSuperAdmin = (req) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();
  return (
    req.user?.isSuperAdmin === true ||
    req.user?.is_super_admin === true ||
    roleId === '0' ||
    roleName.includes('super')
  );
};

const canEditCalendarWork = (calendarWork, userId, userRole, userDesignation) => {
  return true; // Everyone has access to update calendar work items
};

const resolveUploadedImageUrl = (file) => {
  if (!file) return '';

  const diskPath = String(file.path || '').replace(/\\/g, '/');
  const uploadsIndex = diskPath.toLowerCase().lastIndexOf('/uploads/');
  if (uploadsIndex !== -1) {
    return diskPath.slice(uploadsIndex);
  }

  if (file.filename) {
    const nestedDir = path.basename(String(file.destination || ''));
    if (nestedDir && nestedDir !== 'uploads') {
      return `/uploads/tasks/${nestedDir}/${file.filename}`;
    }
    return `/uploads/${file.filename}`;
  }

  return '';
};

const CALENDAR_WORK_POPULATE = [
  { path: 'assignedTo', select: 'name email designation' },
  { path: 'createdBy', select: 'name email' },
  { path: 'updatedBy', select: 'name email' },
  { path: 'updateLogs.updatedBy', select: 'name email' },
  { path: 'project', select: 'projectName' },
  { path: 'client', select: 'companyName' },
  { path: 'task', select: 'title' },
  { path: 'department', select: 'name' }
];

// ============================================================
// CREATE CALENDAR WORK
// ============================================================

export const createCalendarWork = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const {
      title,
      description,
      contentType,
      assignedTo,
      workDate,
      workDueDate,
      postingDate,
      postingTime,
      project,
      client,
      campaign,
      task,
      contentUrl,
      isUrgent,
      isPriority,
      tags,
      imageUrl
    } = req.body;

    if (!title || !String(title).trim()) {
      return sendError(res, 'Title is required', 400);
    }

    // Validate assignedTo user exists
    if (!isValidObjectId(assignedTo)) {
      return sendError(res, 'Invalid assignedTo user ID', 400);
    }

    const assignedUser = await User.findById(assignedTo).select('name email designation designationId department departmentId');
    if (!assignedUser) {
      return sendError(res, 'Assigned user not found', 404);
    }

    // Safely process optional ObjectIds
    const projectId = isValidObjectId(project) ? project : null;
    const clientId = isValidObjectId(client) ? client : null;
    const taskId = isValidObjectId(task) ? task : null;

    if (projectId) {
      const projectExists = await Project.findById(projectId).select('_id');
      if (!projectExists) return sendError(res, 'Project not found', 404);
    }

    if (clientId) {
      const clientExists = await Client.findById(clientId).select('_id');
      if (!clientExists) return sendError(res, 'Client not found', 404);
    }

    if (taskId) {
      const taskExists = await Task.findById(taskId).select('_id');
      if (!taskExists) return sendError(res, 'Task not found', 404);
    }

    // Process dates and time
    const parsedWorkDate = parseValidDate(workDate);
    const parsedWorkDueDate = parseValidDate(workDueDate);
    const parsedPostingDate = parseValidDate(postingDate);
    const cleanPostingTime = formatHHMM(postingTime);

    let scheduledPostTime = null;
    if (parsedPostingDate && cleanPostingTime) {
      try {
        const [hours, minutes] = cleanPostingTime.split(':').map(Number);
        const date = new Date(parsedPostingDate);
        date.setHours(hours, minutes, 0, 0);
        scheduledPostTime = date;
      } catch (err) {
        logger.warn(`Failed to calculate scheduledPostTime: ${err.message}`);
      }
    }

    const calendarWorkData = {
      title: String(title).trim(),
      description: description || '',
      contentType: contentType || 'other',
      assignedTo,
      createdBy: userId,
      workDate: parsedWorkDate,
      workDueDate: parsedWorkDueDate,
      postingDate: parsedPostingDate,
      postingTime: cleanPostingTime,
      scheduledPostTime,
      project: projectId,
      client: clientId,
      campaign: campaign || '',
      task: taskId,
      contentUrl: contentUrl || '',
      isUrgent: Boolean(isUrgent),
      isPriority: Boolean(isPriority),
      tags: Array.isArray(tags) ? tags : [],
      assignedDesignation: assignedUser.designation || '',
      department: assignedUser.departmentId || null,
      imageUrl: resolveUploadedImageUrl(req.file) || (typeof imageUrl === 'string' ? imageUrl.trim() : ''),
      updatedBy: userId,
      updateLogs: [
        {
          updatedBy: userId,
          updatedAt: new Date(),
          action: 'Created Item',
          notes: 'Work item created'
        }
      ]
    };

    const newCalendarWork = new CalendarWork(calendarWorkData);
    await newCalendarWork.save();

    await newCalendarWork.populate([
      { path: 'assignedTo', select: 'name email designation' },
      { path: 'createdBy', select: 'name email' },
      { path: 'project', select: 'projectName' },
      { path: 'client', select: 'companyName' },
      { path: 'task', select: 'title' },
      { path: 'department', select: 'name' }
    ]);

    logger.info(`📅 Calendar work created: ${newCalendarWork._id} by ${userId}`);

    // Trigger notification to assigned person and their team lead
    try {
      await notifyContentAssignedAndTeamLead(newCalendarWork, userId);
    } catch (notifErr) {
      logger.error(`Failed to dispatch calendar work notification: ${notifErr.message}`);
    }

    return sendSuccess(res, 'Calendar work created successfully', newCalendarWork, 201);
  } catch (error) {
    logger.error(`Error creating calendar work: ${error.message}`);
    return sendError(res, error.message || 'Failed to create calendar work', 400);
  }
};

// ============================================================
// GET ALL CALENDAR WORK (with filters)
// ============================================================

export const getCalendarWorks = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const {
      assignedTo,
      workStatus,
      postingStatus,
      department,
      contentType,
      startDate,
      endDate,
      limit = 50,
      skip = 0
    } = req.query;

    const filter = {};

    if (isValidObjectId(assignedTo)) filter.assignedTo = assignedTo;
    if (workStatus) filter.workStatus = workStatus;
    if (postingStatus) filter.postingStatus = postingStatus;
    if (isValidObjectId(department)) filter.department = department;
    if (contentType) filter.contentType = contentType;

    if (startDate || endDate) {
      filter.workDate = {};
      if (startDate && parseValidDate(startDate)) filter.workDate.$gte = parseValidDate(startDate);
      if (endDate && parseValidDate(endDate)) filter.workDate.$lte = parseValidDate(endDate);
    }

    const parsedLimit = Math.max(1, parseInt(limit) || 50);
    const parsedSkip = Math.max(0, parseInt(skip) || 0);

    const total = await CalendarWork.countDocuments(filter);
    const calendarWorks = await CalendarWork.find(filter)
      .populate([
        { path: 'assignedTo', select: 'name email designation' },
        { path: 'createdBy', select: 'name email' },
        { path: 'updatedBy', select: 'name email' },
        { path: 'project', select: 'projectName' },
        { path: 'client', select: 'companyName' },
        { path: 'task', select: 'title' },
        { path: 'department', select: 'name' }
      ])
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(parsedSkip);

    return sendSuccess(res, 'Calendar works retrieved', {
      data: calendarWorks,
      pagination: {
        total,
        limit: parsedLimit,
        skip: parsedSkip,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    logger.error(`Error fetching calendar works: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch calendar works', 500);
  }
};

// ============================================================
// GET MY CALENDAR WORK
// ============================================================

export const getMyCalendarWorks = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const {
      workStatus,
      postingStatus,
      limit = 30,
      skip = 0
    } = req.query;

    const filter = {
      $or: [
        { assignedTo: userId },
        { createdBy: userId }
      ]
    };

    if (workStatus) filter.workStatus = workStatus;
    if (postingStatus) filter.postingStatus = postingStatus;

    const parsedLimit = Math.max(1, parseInt(limit) || 30);
    const parsedSkip = Math.max(0, parseInt(skip) || 0);

    const total = await CalendarWork.countDocuments(filter);
    const calendarWorks = await CalendarWork.find(filter)
      .populate([
        { path: 'assignedTo', select: 'name email designation' },
        { path: 'createdBy', select: 'name email' },
        { path: 'updatedBy', select: 'name email' },
        { path: 'project', select: 'projectName' },
        { path: 'client', select: 'companyName' },
        { path: 'task', select: 'title' }
      ])
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(parsedSkip);

    return sendSuccess(res, 'My calendar works retrieved', {
      data: calendarWorks,
      pagination: {
        total,
        limit: parsedLimit,
        skip: parsedSkip
      }
    });
  } catch (error) {
    logger.error(`Error fetching my calendar works: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch calendar works', 500);
  }
};

// ============================================================
// GET CALENDAR WORK BY ID
// ============================================================

export const getCalendarWorkById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid calendar work ID', 400);
    }

    const calendarWork = await CalendarWork.findById(id)
      .populate([
        { path: 'assignedTo', select: 'name email designation department' },
        { path: 'createdBy', select: 'name email' },
        { path: 'updatedBy', select: 'name email' },
        { path: 'updateLogs.updatedBy', select: 'name email' },
        { path: 'approvedBy', select: 'name email' },
        { path: 'project', select: 'projectName projectCode' },
        { path: 'client', select: 'companyName clientId' },
        { path: 'task', select: 'title status' },
        { path: 'department', select: 'name code' },
        { path: 'workStatusHistory.changedBy', select: 'name' },
        { path: 'postingStatusHistory.changedBy', select: 'name' },
        { path: 'comments.author', select: 'name email' }
      ]);

    if (!calendarWork) {
      return sendError(res, 'Calendar work not found', 404);
    }

    return sendSuccess(res, 'Calendar work retrieved', calendarWork);
  } catch (error) {
    logger.error(`Error fetching calendar work: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch calendar work', 500);
  }
};

// ============================================================
// UPDATE CALENDAR WORK
// ============================================================

export const updateCalendarWork = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid calendar work ID', 400);
    }

    const calendarWork = await CalendarWork.findById(id);
    if (!calendarWork) {
      return sendError(res, 'Calendar work not found', 404);
    }

    if (!canEditCalendarWork(calendarWork, userId, req.user?.role_id, req.user?.designation) && !isSuperAdmin(req)) {
      return sendError(res, 'Not authorized to update this calendar work', 403);
    }

    const {
      title,
      description,
      contentType,
      assignedTo,
      workDate,
      workDueDate,
      postingDate,
      postingTime,
      project,
      client,
      campaign,
      contentUrl,
      approvalNotes,
      revisionNotes,
      isUrgent,
      isPriority,
      tags,
      imageUrl,
      removeImage
    } = req.body;

    if (title !== undefined) calendarWork.title = String(title).trim();
    if (description !== undefined) calendarWork.description = description;
    if (contentType !== undefined) calendarWork.contentType = contentType;

    if (assignedTo !== undefined) {
      if (!isValidObjectId(assignedTo)) {
        return sendError(res, 'Invalid assignedTo user ID', 400);
      }
      const user = await User.findById(assignedTo).select('name designation designationId department departmentId');
      if (!user) {
        return sendError(res, 'Assigned user not found', 404);
      }
      calendarWork.assignedTo = assignedTo;
      calendarWork.assignedDesignation = user.designation || '';
      calendarWork.department = user.departmentId || null;
    }

    if (workDate !== undefined) calendarWork.workDate = parseValidDate(workDate);
    if (workDueDate !== undefined) calendarWork.workDueDate = parseValidDate(workDueDate);

    if (postingDate !== undefined || postingTime !== undefined) {
      if (postingDate !== undefined) calendarWork.postingDate = parseValidDate(postingDate);
      if (postingTime !== undefined) calendarWork.postingTime = formatHHMM(postingTime);

      if (calendarWork.postingDate && calendarWork.postingTime) {
        try {
          const [hours, minutes] = calendarWork.postingTime.split(':').map(Number);
          const date = new Date(calendarWork.postingDate);
          date.setHours(hours, minutes, 0, 0);
          calendarWork.scheduledPostTime = date;
        } catch (err) {
          logger.warn(`Failed to recalculate scheduledPostTime: ${err.message}`);
        }
      }
    }

    if (project !== undefined) calendarWork.project = isValidObjectId(project) ? project : null;
    if (client !== undefined) calendarWork.client = isValidObjectId(client) ? client : null;
    if (campaign !== undefined) calendarWork.campaign = campaign || '';
    if (contentUrl !== undefined) calendarWork.contentUrl = contentUrl || '';
    if (approvalNotes !== undefined) calendarWork.approvalNotes = approvalNotes || '';
    if (revisionNotes !== undefined) calendarWork.revisionNotes = revisionNotes || '';
    if (isUrgent !== undefined) calendarWork.isUrgent = Boolean(isUrgent);
    if (isPriority !== undefined) calendarWork.isPriority = Boolean(isPriority);
    if (tags !== undefined) calendarWork.tags = Array.isArray(tags) ? tags : [];

    const uploadedImageUrl = resolveUploadedImageUrl(req.file);
    if (uploadedImageUrl) {
      calendarWork.imageUrl = uploadedImageUrl;
    } else if (removeImage) {
      calendarWork.imageUrl = '';
    } else if (imageUrl !== undefined) {
      calendarWork.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    }

    calendarWork.updatedBy = userId;
    calendarWork.updateLogs.push({
      updatedBy: userId,
      updatedAt: new Date(),
      action: 'Updated Details',
      notes: 'Calendar item details updated'
    });
    await calendarWork.save();

    await calendarWork.populate([
      { path: 'assignedTo', select: 'name email designation' },
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' },
      { path: 'updateLogs.updatedBy', select: 'name email' },
      { path: 'project', select: 'projectName' },
      { path: 'client', select: 'companyName' },
      { path: 'task', select: 'title' }
    ]);

    logger.info(`📅 Calendar work updated: ${id} by ${userId}`);
    return sendSuccess(res, 'Calendar work updated successfully', calendarWork);
  } catch (error) {
    logger.error(`Error updating calendar work: ${error.message}`);
    return sendError(res, error.message || 'Failed to update calendar work', 400);
  }
};

// ============================================================
// UPDATE WORK STATUS
// ============================================================

export const updateWorkStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid calendar work ID', 400);
    }

    const calendarWork = await CalendarWork.findById(id);
    if (!calendarWork) {
      return sendError(res, 'Calendar work not found', 404);
    }

    if (!canEditCalendarWork(calendarWork, userId, req.user?.role_id, req.user?.designation) && !isSuperAdmin(req)) {
      return sendError(res, 'Not authorized to update status', 403);
    }

    const previousStatus = calendarWork.workStatus;
    calendarWork.workStatus = status;
    calendarWork.updatedBy = userId;

    const formattedStatus = status.replace(/_/g, ' ');
    calendarWork.workStatusHistory.push({
      status,
      changedBy: userId,
      changedAt: new Date(),
      notes: notes || ''
    });

    calendarWork.updateLogs.push({
      updatedBy: userId,
      updatedAt: new Date(),
      action: `Work Status: ${formattedStatus}`,
      notes: notes || `Work status changed to ${formattedStatus}`
    });

    await calendarWork.save();

    await calendarWork.populate(CALENDAR_WORK_POPULATE);

    logger.info(`📅 Calendar work status updated: ${id} from ${previousStatus} to ${status} by ${userId}`);
    return sendSuccess(res, 'Work status updated', calendarWork);
  } catch (error) {
    logger.error(`Error updating work status: ${error.message}`);
    return sendError(res, error.message || 'Failed to update work status', 400);
  }
};

// ============================================================
// UPDATE POSTING STATUS
// ============================================================

export const updatePostingStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const { id } = req.params;
    const { status, actualPostTime, socialMediaLinks, notes } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid calendar work ID', 400);
    }

    const calendarWork = await CalendarWork.findById(id);
    if (!calendarWork) {
      return sendError(res, 'Calendar work not found', 404);
    }

    if (!canEditCalendarWork(calendarWork, userId, req.user?.role_id, req.user?.designation) && !isSuperAdmin(req)) {
      return sendError(res, 'Not authorized to update posting status', 403);
    }

    const previousStatus = calendarWork.postingStatus;
    calendarWork.postingStatus = status;
    calendarWork.updatedBy = userId;

    if (status === 'posted') {
      calendarWork.actualPostTime = parseValidDate(actualPostTime) || new Date();
      calendarWork.reminderSent = false;
    }

    if (Array.isArray(socialMediaLinks)) {
      calendarWork.socialMediaLinks = socialMediaLinks;
    }

    const formattedPostingStatus = status.replace(/_/g, ' ');
    calendarWork.postingStatusHistory.push({
      status,
      changedBy: userId,
      changedAt: new Date(),
      notes: notes || ''
    });

    calendarWork.updateLogs.push({
      updatedBy: userId,
      updatedAt: new Date(),
      action: `Posting Status: ${formattedPostingStatus}`,
      notes: notes || `Posting status changed to ${formattedPostingStatus}`
    });

    await calendarWork.save();

    logger.info(`📅 Calendar work posting status updated: ${id} from ${previousStatus} to ${status} by ${userId}`);
    return sendSuccess(res, 'Posting status updated', calendarWork);
  } catch (error) {
    logger.error(`Error updating posting status: ${error.message}`);
    return sendError(res, error.message || 'Failed to update posting status', 400);
  }
};

// ============================================================
// DELETE CALENDAR WORK
// ============================================================

export const deleteCalendarWork = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return sendError(res, 'Authenticated user not found', 401);
    }

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid calendar work ID', 400);
    }

    const calendarWork = await CalendarWork.findById(id);
    if (!calendarWork) {
      return sendError(res, 'Calendar work not found', 404);
    }

    if (String(calendarWork.createdBy) !== String(userId) && !isSuperAdmin(req)) {
      return sendError(res, 'Not authorized to delete this calendar work', 403);
    }

    await CalendarWork.findByIdAndDelete(id);

    logger.info(`📅 Calendar work deleted: ${id} by ${userId}`);
    return sendSuccess(res, 'Calendar work deleted successfully');
  } catch (error) {
    logger.error(`Error deleting calendar work: ${error.message}`);
    return sendError(res, error.message || 'Failed to delete calendar work', 500);
  }
};