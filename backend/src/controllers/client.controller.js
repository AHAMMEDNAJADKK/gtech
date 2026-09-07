import Client from '../models/client.model.js';
import ClientMeeting from '../models/clientMeeting.model.js';
import ClientFollowup from '../models/clientFollowup.model.js';
import Project from '../models/project.model.js';
import ProjectDocument from '../models/projectDocument.model.js';
import ProjectActivity from '../models/projectActivity.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { generateClientId, fetchClientStats } from '../services/client.service.js';
import { sendSuccess, sendError } from '../utils/response.helper.js';

/**
 * Sanitizes incoming request payload to convert empty strings
 * for optional ObjectId and Date fields into null/undefined.
 */
const sanitizeClientPayload = (body) => {
  const sanitized = { ...body };

  const objectIdFields = ['accountManager', 'assignedTeamLead'];
  objectIdFields.forEach(field => {
    if (sanitized[field] === '' || sanitized[field] === undefined || sanitized[field] === null) {
      delete sanitized[field];
    }
  });

  const dateFields = ['contractStart', 'contractEnd'];
  dateFields.forEach(field => {
    if (sanitized[field] === '' || sanitized[field] === undefined || sanitized[field] === null) {
      delete sanitized[field];
    }
  });

  return sanitized;
};

export const getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      clientType,
      priority,
      industry,
      accountManager,
      assignedTeamLead,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { clientId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { alternativePhone: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (clientType) query.clientType = clientType;
    if (priority) query.priority = priority;
    if (industry) query.industry = { $regex: industry, $options: 'i' };
    if (accountManager && mongoose.Types.ObjectId.isValid(accountManager)) query.accountManager = accountManager;
    if (assignedTeamLead && mongoose.Types.ObjectId.isValid(assignedTeamLead)) query.assignedTeamLead = assignedTeamLead;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const sortFieldMap = {
      revenue: 'expectedMonthlyRevenue',
      company: 'companyName',
      client: 'clientName',
      newest: 'createdAt',
      oldest: 'createdAt'
    };
    const mappedSortBy = sortFieldMap[sortBy] || sortBy;
    const finalSortOrder = sortBy === 'oldest' ? 1 : (sortBy === 'newest' ? -1 : (sortOrder === 'asc' ? 1 : -1));
    const sort = { [mappedSortBy]: finalSortOrder };

    const clients = await Client.find(query)
      .populate('accountManager', 'name email avatar employeeId designation')
      .populate('assignedTeamLead', 'name email avatar employeeId designation')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .exec();

    const total = await Client.countDocuments(query);
    const stats = await fetchClientStats();

    return sendSuccess(res, 'Clients retrieved successfully', {
      clients,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)) || 1
      },
      stats
    });
  } catch (error) {
    console.error('getClients Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return sendError(res, 'Client ID is required', 400);
    }

    const clientQuery = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { clientId: id }] }
      : { clientId: id };

    const client = await Client.findOne(clientQuery)
      .populate('accountManager', 'name email avatar employeeId phone designation department')
      .populate('assignedTeamLead', 'name email avatar employeeId phone designation department')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();

    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const projects = await Project.find({ client: client._id })
      .populate('projectManager', 'name email avatar')
      .populate('assignedTeamLead', 'name email avatar')
      .populate('assignedEmployees', 'name email avatar role')
      .sort({ createdAt: -1 });

    const documents = await ProjectDocument.find({ client: client._id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    const activities = await ProjectActivity.find({ client: client._id })
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    const meetings = await ClientMeeting.find({ client: client._id })
      .populate('createdBy', 'name email avatar')
      .sort({ date: -1, time: -1 });

    const followups = await ClientFollowup.find({ client: client._id })
      .populate('createdBy', 'name email avatar')
      .sort({ dueDate: 1 });

    return sendSuccess(res, 'Client details retrieved successfully', {
      client,
      projects,
      documents,
      activities,
      meetings,
      followups
    });
  } catch (error) {
    console.error('getClientById Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const createClient = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array()[0].msg, 400);
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const clientId = await generateClientId();
    const sanitizedBody = sanitizeClientPayload(req.body);

    const newClient = new Client({
      ...sanitizedBody,
      clientId,
      createdBy: userId,
      updatedBy: userId
    });

    await newClient.save();

    const populatedClient = await Client.findById(newClient._id)
      .populate('accountManager', 'name email avatar employeeId')
      .populate('assignedTeamLead', 'name email avatar employeeId');

    // Non-blocking activity logging
    try {
      if (userId) {
        await ProjectActivity.create({
          client: newClient._id,
          user: userId,
          action: 'CLIENT_CREATED',
          title: `New Client Account Created: ${newClient.companyName}`,
          description: `Client ID ${clientId} assigned`
        });
      }
    } catch (actErr) {
      console.warn('Non-fatal warning: Client creation activity logging failed:', actErr.message);
    }

    return sendSuccess(res, 'Client created successfully', populatedClient, 201);
  } catch (error) {
    console.error('createClient Error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return sendError(res, `A client record with this ${field} already exists.`, 409);
    }
    return sendError(res, error.message, 500);
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return sendError(res, 'Client ID is required', 400);
    }

    const clientQuery = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { clientId: id }] }
      : { clientId: id };

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const sanitizedBody = sanitizeClientPayload(req.body);

    const updatedClient = await Client.findOneAndUpdate(
      clientQuery,
      {
        ...sanitizedBody,
        updatedBy: userId
      },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('accountManager', 'name email avatar employeeId')
      .populate('assignedTeamLead', 'name email avatar employeeId');

    if (!updatedClient) {
      return sendError(res, 'Client not found', 404);
    }

    // Non-blocking activity logging
    try {
      if (userId) {
        await ProjectActivity.create({
          client: updatedClient._id,
          user: userId,
          action: 'CLIENT_UPDATED',
          title: `Client Account Updated: ${updatedClient.companyName}`,
          description: `Client profile updated by system user`
        });
      }
    } catch (actErr) {
      console.warn('Non-fatal warning: Client update activity logging failed:', actErr.message);
    }

    return sendSuccess(res, 'Client details updated successfully', updatedClient);
  } catch (error) {
    console.error('updateClient Error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return sendError(res, `A client record with this ${field} already exists.`, 409);
    }
    return sendError(res, error.message, 500);
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return sendError(res, 'Client ID is required', 400);
    }

    const clientQuery = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { clientId: id }] }
      : { clientId: id };

    const client = await Client.findOneAndDelete(clientQuery);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    try {
      if (userId) {
        await ProjectActivity.create({
          client: client._id,
          user: userId,
          action: 'CLIENT_DELETED',
          title: `Client Account Deleted: ${client.companyName}`,
          description: `Client ID ${client.clientId} removed from system`
        });
      }
    } catch (actErr) {
      console.warn('Non-fatal warning: Client deletion activity logging failed:', actErr.message);
    }

    return sendSuccess(res, 'Client deleted successfully', { id: client._id });
  } catch (error) {
    console.error('deleteClient Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const exportClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .populate('accountManager', 'name email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Client data exported successfully', clients);
  } catch (error) {
    console.error('exportClients Error:', error);
    return sendError(res, error.message, 500);
  }
};

/**
 * Helper to resolve client by ObjectId or custom clientId string
 */
const resolveClientDoc = async (id) => {
  if (!id) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  return await Client.findOne(isObjectId ? { _id: id } : { clientId: id.toUpperCase() });
};

// ==========================================
// CLIENT MEETINGS CRUD
// ==========================================

export const getClientMeetings = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const meetings = await ClientMeeting.find({ client: client._id })
      .populate('createdBy', 'name email avatar')
      .sort({ date: -1, time: -1 });

    return sendSuccess(res, 'Meetings retrieved successfully', meetings);
  } catch (error) {
    console.error('getClientMeetings Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const createClientMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const { title, date, time, type, status, attendees, notes } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, 'Meeting title is required', 400);
    }
    if (!date) {
      return sendError(res, 'Meeting date is required', 400);
    }

    const meeting = new ClientMeeting({
      client: client._id,
      title: title.trim(),
      date,
      time: time || '10:00 AM',
      type: type || 'Online (Google Meet)',
      status: status || 'Scheduled',
      attendees: attendees ? attendees.trim() : 'Account Manager',
      notes: notes ? notes.trim() : '',
      createdBy: userId
    });

    await meeting.save();

    // Log activity
    try {
      if (userId) {
        await ProjectActivity.create({
          client: client._id,
          user: userId,
          action: 'MEETING_SCHEDULED',
          title: `Meeting Scheduled: ${meeting.title}`,
          description: `Scheduled for ${meeting.date} at ${meeting.time} (${meeting.type})`
        });
      }
    } catch (actErr) {}

    return sendSuccess(res, 'Meeting scheduled successfully', meeting, 201);
  } catch (error) {
    console.error('createClientMeeting Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const updateClientMeeting = async (req, res) => {
  try {
    const { id, meetingId } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const meeting = await ClientMeeting.findOne({ _id: meetingId, client: client._id });
    if (!meeting) {
      return sendError(res, 'Meeting not found', 404);
    }

    const { title, date, time, type, status, attendees, notes } = req.body;
    if (title !== undefined) meeting.title = title.trim();
    if (date !== undefined) meeting.date = date;
    if (time !== undefined) meeting.time = time;
    if (type !== undefined) meeting.type = type;
    if (status !== undefined) meeting.status = status;
    if (attendees !== undefined) meeting.attendees = attendees.trim();
    if (notes !== undefined) meeting.notes = notes.trim();

    await meeting.save();

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    try {
      if (userId && status === 'Completed') {
        await ProjectActivity.create({
          client: client._id,
          user: userId,
          action: 'MEETING_COMPLETED',
          title: `Completed Meeting: ${meeting.title}`,
          description: `Date: ${meeting.date} at ${meeting.time} (${meeting.type})`
        });
      }
    } catch (actErr) {}

    return sendSuccess(res, 'Meeting updated successfully', meeting);
  } catch (error) {
    console.error('updateClientMeeting Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const deleteClientMeeting = async (req, res) => {
  try {
    const { id, meetingId } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const meeting = await ClientMeeting.findOneAndDelete({ _id: meetingId, client: client._id });
    if (!meeting) {
      return sendError(res, 'Meeting not found', 404);
    }

    return sendSuccess(res, 'Meeting deleted successfully', { id: meetingId });
  } catch (error) {
    console.error('deleteClientMeeting Error:', error);
    return sendError(res, error.message, 500);
  }
};

// ==========================================
// CLIENT FOLLOW-UPS CRUD
// ==========================================

export const getClientFollowups = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const followups = await ClientFollowup.find({ client: client._id })
      .populate('createdBy', 'name email avatar')
      .sort({ dueDate: 1 });

    return sendSuccess(res, 'Follow-ups retrieved successfully', followups);
  } catch (error) {
    console.error('getClientFollowups Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const createClientFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const { title, dueDate, dueTime, priority, status, notes } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, 'Follow-up title is required', 400);
    }
    if (!dueDate) {
      return sendError(res, 'Due date is required', 400);
    }

    const followup = new ClientFollowup({
      client: client._id,
      title: title.trim(),
      dueDate,
      dueTime: dueTime || '03:00 PM',
      priority: priority || 'High',
      status: status || 'Pending',
      notes: notes ? notes.trim() : '',
      createdBy: userId
    });

    await followup.save();

    return sendSuccess(res, 'Follow-up created successfully', followup, 201);
  } catch (error) {
    console.error('createClientFollowup Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const updateClientFollowup = async (req, res) => {
  try {
    const { id, followupId } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const followup = await ClientFollowup.findOne({ _id: followupId, client: client._id });
    if (!followup) {
      return sendError(res, 'Follow-up not found', 404);
    }

    const { title, dueDate, dueTime, priority, status, notes } = req.body;
    if (title !== undefined) followup.title = title.trim();
    if (dueDate !== undefined) followup.dueDate = dueDate;
    if (dueTime !== undefined) followup.dueTime = dueTime;
    if (priority !== undefined) followup.priority = priority;
    if (status !== undefined) followup.status = status;
    if (notes !== undefined) followup.notes = notes.trim();

    await followup.save();

    return sendSuccess(res, 'Follow-up updated successfully', followup);
  } catch (error) {
    console.error('updateClientFollowup Error:', error);
    return sendError(res, error.message, 500);
  }
};

export const deleteClientFollowup = async (req, res) => {
  try {
    const { id, followupId } = req.params;
    const client = await resolveClientDoc(id);
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const followup = await ClientFollowup.findOneAndDelete({ _id: followupId, client: client._id });
    if (!followup) {
      return sendError(res, 'Follow-up not found', 404);
    }

    return sendSuccess(res, 'Follow-up deleted successfully', { id: followupId });
  } catch (error) {
    console.error('deleteClientFollowup Error:', error);
    return sendError(res, error.message, 500);
  }
};
