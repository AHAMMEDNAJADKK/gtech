import Client from '../models/client.model.js';
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

    return sendSuccess(res, 'Client details retrieved successfully', {
      client,
      projects,
      documents,
      activities
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
