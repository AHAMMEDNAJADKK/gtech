import Lead from '../models/lead.model.js';
import LeadFollowup from '../models/leadFollowup.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.util.js';
import redis from '../config/redis.js';

// Helper to escape special regex characters and protect against ReDoS
const escapeRegex = (string) => {
  return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Audit logging helper
const logAudit = (action, req, resourceId, details) => {
  const userId = req.user?.id || req.user?._id || 'unknown';
  const userRole = req.user?.role || 'unknown';
  
  logger.info({
    message: `AUDIT: [${action}] executed by user [${userId}] (${userRole}) on resource [${resourceId}]`,
    action,
    userId,
    userRole,
    resourceId,
    details,
    timestamp: new Date().toISOString()
  });
};

// Optimized Analytics cache invalidation helper using SCAN instead of KEYS
const clearAnalyticsCache = async () => {
  try {
    let cursor = '0';
    let totalCleared = 0;
    
    do {
      // SCAN yields a chunk of keys matching the pattern without locking up Redis
      const reply = await redis.scan(cursor, 'MATCH', 'analytics:*', 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      
      if (keys.length > 0) {
        await redis.del(keys);
        totalCleared += keys.length;
      }
    } while (cursor !== '0');

    if (totalCleared > 0) {
      console.log(`🧹 Cleared ${totalCleared} analytics cache keys due to lead modification`);
    }
  } catch (err) {
    console.warn('Failed to clear Redis analytics cache:', err.message);
  }
};

const isTransactionUnsupportedError = (err) => {
  if (!err) return false;
  const msg = String(err.message || err);
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('Standalone servers do not support transactions') ||
    msg.includes('replica set') ||
    err.code === 20 ||
    err.codeName === 'IllegalOperation'
  );
};

const runTransactionWithFallback = async (transactionWork, fallbackWork) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await transactionWork(session);
    });
    await session.endSession();
    return result;
  } catch (err) {
    if (session) {
      try { await session.endSession(); } catch (_) {}
    }
    if (isTransactionUnsupportedError(err)) {
      return await fallbackWork();
    }
    throw err;
  }
};

export const leadController = {
  /**
   * GET /api/v1/leads
   * Get all leads with status, search, and user-role filters
   */
  getLeads: async (req, res) => {
    try {
      const { status, search, assignedTo, priority, city, dateFrom, dateTo, sortOrder } = req.query;
      const whereClause = {};

      const userRole = String(req.user?.role || req.user?.role_id || '').toLowerCase().trim();
      const userId = req.user?.id || req.user?._id;

      // Filter by Assigned User
      if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
        whereClause.assignedTo = assignedTo;
      }

      // Filter by Status
      if (status && status !== 'all') {
        if (status === 'assigned') {
          whereClause.assignedTo = { $ne: null };
        } else if (status === 'follow-up') {
          whereClause.nextFollowUpDate = { $exists: true, $ne: null };
          whereClause.status = 'Follow Up';
        } else if (status === 'converted') {
          whereClause.status = 'Converted';
        } else if (status === 'lost') {
          whereClause.status = 'Lost';
        } else {
          whereClause.status = status;
        }
      }

      // Filter by Priority
      if (priority && priority !== 'all') {
        whereClause.priority = priority;
      }

      // Filter by City
      if (city && city !== 'all') {
        const escapedCity = escapeRegex(city.trim());
        whereClause.city = { $regex: `^${escapedCity}$`, $options: 'i' };
      }

      // Filter by Date Range on createdAt
      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt.$gte = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          whereClause.createdAt.$lte = endDate;
        }
      }

      // Filter by Safe Search text
      if (search) {
        const safeSearch = escapeRegex(search.trim());
        const searchRegex = { $regex: safeSearch, $options: 'i' };
        whereClause.$or = [
          { leadName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { companyName: searchRegex },
          { city: searchRegex },
          { source: searchRegex },
          { interestedService: searchRegex },
          { campaignName: searchRegex },
          { leadPlatform: searchRegex }
        ];
      }

      const isPaginationRequested = (req.query.page !== undefined && req.query.page !== '' && !isNaN(req.query.page)) || 
                                    (req.query.limit !== undefined && req.query.limit !== '' && !isNaN(req.query.limit));
      const sortDirection = sortOrder === 'asc' ? 1 : -1;

      let query = Lead.find(whereClause)
        .populate('assignedTo', 'name email role profile_image')
        .populate('createdBy', 'name email')
        .sort({ createdAt: sortDirection });

      let page = 1;
      let limit = 1000000; // Default to 1 million (virtually unlimited)

      if (isPaginationRequested) {
        page = Math.max(1, parseInt(req.query.page, 10) || 1);
        limit = Math.max(1, parseInt(req.query.limit, 10) || 1000000);
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
      }

      // Parallelize count and find operations to save IO execution wait loops
      const [totalLeads, leads] = await Promise.all([
        Lead.countDocuments(whereClause),
        query.lean() // Converts mongoose records to plain JS objects for faster processing
      ]);

      const responsePage = isPaginationRequested ? page : 1;
      const responseLimit = isPaginationRequested ? limit : totalLeads || 1;
      const responsePages = isPaginationRequested ? Math.ceil(totalLeads / limit) : 1;

      return res.status(200).json({
        success: true,
        data: leads,
        pagination: {
          total: totalLeads,
          page: responsePage,
          limit: responseLimit,
          pages: responsePages
        }
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch leads',
        error: error.message
      });
    }
  },

  /**
   * GET /api/v1/leads/:id
   */
  getLeadById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid Lead ID' });
      }

      const lead = await Lead.findById(id)
        .populate('assignedTo', 'name email role profile_image')
        .populate('createdBy', 'name email')
        .lean();

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }



      const followups = await LeadFollowup.find({ leadId: id })
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: { lead, followups }
      });
    } catch (error) {
      console.error('Error fetching lead details:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch lead details',
        error: error.message
      });
    }
  },

  /**
   * POST /api/v1/leads/create
   * Atomic ACID Transaction handling
   */
  createLead: async (req, res) => {
    try {
      let createdLead;
      const createdById = req.user?.id || req.user?._id;
      const {
        leadName, companyName, email, phone, city, source,
        interestedService, campaignName, leadPlatform, assignedTo, status, priority, remarks, nextFollowUpDate,
        clientMeetingFixed, admissionYesNo, leadsReceivedDate,
        followUpDate1, followUpDate2, followUpDate3, followUpDate4, followUpDate5
      } = req.body;

      if (!leadName || !phone) {
        return res.status(400).json({ success: false, message: 'Lead Name and Phone Number are required.' });
      }

      const leadPayload = {
        leadName, companyName, email, phone, city, source, interestedService, campaignName, leadPlatform,
        assignedTo: mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
        status: status || 'New',
        priority: priority || 'Medium',
        clientMeetingFixed: clientMeetingFixed || '',
        admissionYesNo: admissionYesNo || '',
        remarks,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        leadsReceivedDate: leadsReceivedDate ? new Date(leadsReceivedDate) : null,
        followUpDate1: followUpDate1 ? new Date(followUpDate1) : null,
        followUpDate2: followUpDate2 ? new Date(followUpDate2) : null,
        followUpDate3: followUpDate3 ? new Date(followUpDate3) : null,
        followUpDate4: followUpDate4 ? new Date(followUpDate4) : null,
        followUpDate5: followUpDate5 ? new Date(followUpDate5) : null,
        createdBy: createdById
      };

      if (leadPayload.status === 'Converted') {
        leadPayload.convertedAt = new Date();
      }

      const performCreate = async (opts = {}) => {
        if (opts.session) {
          const [newLead] = await Lead.create([leadPayload], opts);
          createdLead = newLead;
        } else {
          createdLead = await Lead.create(leadPayload);
        }
        const initialFollowup = new LeadFollowup({
          leadId: createdLead._id,
          remarks: remarks || 'Lead created in CRM.',
          statusChangedTo: createdLead.status,
          nextFollowUpDate: createdLead.nextFollowUpDate,
          createdBy: createdById
        });
        await initialFollowup.save(opts);
      };

      await runTransactionWithFallback(
        (session) => performCreate({ session }),
        () => performCreate({})
      );

      // Post transactions (async)
      await clearAnalyticsCache();
      logAudit('CREATE_LEAD', req, createdLead._id, { leadName: createdLead.leadName, status: createdLead.status });

      return res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: createdLead
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create lead',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/v1/leads/update/:id
   */
  updateLead: async (req, res) => {
    try {
      const id = req.params.id || req.body.id || req.body._id;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Valid Lead ID is required.' });
      }

      let updatedLead;
      const userId = req.user?.id || req.user?._id;

      const performUpdate = async (opts = {}) => {
        const query = Lead.findById(id);
        if (opts.session) query.session(opts.session);
        const lead = await query;

        if (!lead) {
          throw new Error('NOT_FOUND_ERROR: Lead not found');
        }

        const {
          leadName, companyName, email, phone, city, source,
          interestedService, campaignName, leadPlatform, assignedTo, status, priority, remarks, nextFollowUpDate, lostReason,
          clientMeetingFixed, admissionYesNo, leadsReceivedDate,
          followUpDate1, followUpDate2, followUpDate3, followUpDate4, followUpDate5
        } = req.body;

        const previousStatus = lead.status;
        const previousAssignment = lead.assignedTo;

        if (leadName !== undefined) lead.leadName = leadName;
        if (companyName !== undefined) lead.companyName = companyName;
        if (email !== undefined) lead.email = email;
        if (phone !== undefined) lead.phone = phone;
        if (city !== undefined) lead.city = city;
        if (source !== undefined) lead.source = source;
        if (interestedService !== undefined) lead.interestedService = interestedService;
        if (campaignName !== undefined) lead.campaignName = campaignName;
        if (leadPlatform !== undefined) lead.leadPlatform = leadPlatform;
        if (priority !== undefined) lead.priority = priority;
        if (clientMeetingFixed !== undefined) lead.clientMeetingFixed = clientMeetingFixed;
        if (admissionYesNo !== undefined) lead.admissionYesNo = admissionYesNo;
        if (remarks !== undefined) lead.remarks = remarks;
        if (nextFollowUpDate !== undefined) lead.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
        if (leadsReceivedDate !== undefined) lead.leadsReceivedDate = leadsReceivedDate ? new Date(leadsReceivedDate) : null;
        if (followUpDate1 !== undefined) lead.followUpDate1 = followUpDate1 ? new Date(followUpDate1) : null;
        if (followUpDate2 !== undefined) lead.followUpDate2 = followUpDate2 ? new Date(followUpDate2) : null;
        if (followUpDate3 !== undefined) lead.followUpDate3 = followUpDate3 ? new Date(followUpDate3) : null;
        if (followUpDate4 !== undefined) lead.followUpDate4 = followUpDate4 ? new Date(followUpDate4) : null;
        if (followUpDate5 !== undefined) lead.followUpDate5 = followUpDate5 ? new Date(followUpDate5) : null;

        if (assignedTo !== undefined) {
          lead.assignedTo = mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null;
        }

        if (status !== undefined) {
          lead.status = status;
          if (status === 'Converted' && previousStatus !== 'Converted') {
            lead.convertedAt = new Date();
            lead.lostReason = undefined;
          } else if (status === 'Lost') {
            lead.lostReason = lostReason || 'Not specified';
            lead.convertedAt = undefined;
          } else {
            lead.convertedAt = undefined;
            lead.lostReason = undefined;
          }
        }

        await lead.save(opts);
        updatedLead = lead;

        // Change history logic
        const changes = [];
        if (status && status !== previousStatus) {
          changes.push(`Status changed from "${previousStatus}" to "${status}"`);
        }
        if (assignedTo !== undefined && String(assignedTo || '') !== String(previousAssignment || '')) {
          const staff = await User.findById(assignedTo).lean();
          const staffName = staff ? staff.name : 'Unassigned/Unknown';
          changes.push(`Lead assigned to "${staffName}"`);
        }

        if (changes.length > 0) {
          const changeFollowup = new LeadFollowup({
            leadId: lead._id,
            remarks: `Lead updated. ${changes.join('. ')}.`,
            statusChangedTo: status || lead.status,
            nextFollowUpDate: lead.nextFollowUpDate,
            createdBy: userId
          });
          await changeFollowup.save(opts);
        }
      };

      await runTransactionWithFallback(
        (session) => performUpdate({ session }),
        () => performUpdate({})
      );

      await clearAnalyticsCache();
      logAudit('UPDATE_LEAD', req, updatedLead._id, { updateStatus: 'Basic tracking logged' });

      return res.status(200).json({
        success: true,
        message: 'Lead updated successfully',
        data: updatedLead
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      
      if (error.message?.startsWith('NOT_FOUND_ERROR:')) return res.status(404).json({ success: false, message: error.message.split(': ')[1] });
      if (error.message?.startsWith('FORBIDDEN_ERROR:')) return res.status(403).json({ success: false, message: error.message.split(': ')[1] });
      
      return res.status(500).json({ success: false, message: 'Failed to update lead', error: error.message });
    }
  },

  /**
   * POST /api/v1/leads/followup
   */
  addFollowUp: async (req, res) => {
    try {
      const leadId = req.body.leadId || req.body.id || req.params.id;
      const { remarks, nextFollowUpDate, callSummary, meetingNotes, statusChangedTo } = req.body;

      if (!leadId || !mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({ success: false, message: 'Valid Lead ID is required.' });
      }

      if (!remarks && !callSummary && !meetingNotes && !statusChangedTo) {
        return res.status(400).json({ success: false, message: 'At least one summary field required.' });
      }

      let createdFollowup;
      const createdById = req.user?.id || req.user?._id;

      const performAddFollowup = async (opts = {}) => {
        const query = Lead.findById(leadId);
        if (opts.session) query.session(opts.session);
        const lead = await query;

        if (!lead) {
          throw new Error('NOT_FOUND_ERROR: Lead not found');
        }

        const followup = new LeadFollowup({
          leadId,
          remarks: remarks || 'Follow-up logged.',
          nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
          callSummary,
          meetingNotes,
          statusChangedTo: statusChangedTo || lead.status,
          createdBy: createdById
        });
        await followup.save(opts);
        createdFollowup = followup;

        if (statusChangedTo) {
          const previousStatus = lead.status;
          lead.status = statusChangedTo;
          if (statusChangedTo === 'Converted' && previousStatus !== 'Converted') {
            lead.convertedAt = new Date();
            lead.lostReason = undefined;
          } else if (statusChangedTo === 'Lost') {
            lead.lostReason = req.body.lostReason || 'Not specified';
            lead.convertedAt = undefined;
          }
        }

        if (nextFollowUpDate !== undefined) lead.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
        if (remarks) lead.remarks = remarks;

        await lead.save(opts);
      };

      await runTransactionWithFallback(
        (session) => performAddFollowup({ session }),
        () => performAddFollowup({})
      );

      await clearAnalyticsCache();
      logAudit('ADD_FOLLOWUP', req, leadId, { statusChangedTo });

      return res.status(201).json({
        success: true,
        message: 'Follow-up logged successfully',
        data: createdFollowup
      });
    } catch (error) {
      if (error.message?.startsWith('NOT_FOUND_ERROR:')) return res.status(404).json({ success: false, message: error.message.split(': ')[1] });
      return res.status(500).json({ success: false, message: 'Failed to record follow-up', error: error.message });
    }
  },

  /**
   * POST /api/v1/leads/status-update
   */
  updateStatus: async (req, res) => {
    try {
      const leadId = req.body.leadId || req.body.id || req.params.id;
      const { status, lostReason } = req.body;

      if (!leadId || !mongoose.Types.ObjectId.isValid(leadId) || !status) {
        return res.status(400).json({ success: false, message: 'Lead ID and Status are required.' });
      }

      const performStatusUpdate = async (opts = {}) => {
        const query = Lead.findById(leadId);
        if (opts.session) query.session(opts.session);
        const lead = await query;

        if (!lead) throw new Error('NOT_FOUND_ERROR: Lead not found');

        const previousStatus = lead.status;
        lead.status = status;

        if (status === 'Converted' && previousStatus !== 'Converted') {
          lead.convertedAt = new Date();
          lead.lostReason = undefined;
        } else if (status === 'Lost') {
          lead.lostReason = lostReason || 'Not specified';
          lead.convertedAt = undefined;
        } else {
          lead.convertedAt = undefined;
          lead.lostReason = undefined;
        }

        await lead.save(opts);

        const followup = new LeadFollowup({
          leadId,
          remarks: `Status updated directly from "${previousStatus}" to "${status}".`,
          statusChangedTo: status,
          nextFollowUpDate: lead.nextFollowUpDate,
          createdBy: req.user?.id || req.user?._id
        });
        await followup.save(opts);
      };

      await runTransactionWithFallback(
        (session) => performStatusUpdate({ session }),
        () => performStatusUpdate({})
      );

      await clearAnalyticsCache();
      logAudit('STATUS_UPDATE', req, leadId, { status });

      return res.status(200).json({ success: true, message: 'Lead status updated successfully' });
    } catch (error) {
      if (error.message?.startsWith('NOT_FOUND_ERROR:')) return res.status(404).json({ success: false, message: error.message.split(': ')[1] });
      return res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
    }
  },

  /**
   * DELETE /api/v1/leads/delete/:id
   */
  deleteLead: async (req, res) => {
    try {
      const id = req.params.id || req.body.id || req.body._id;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Valid Lead ID required.' });
      }

      const performDelete = async (opts = {}) => {
        const query = Lead.findById(id);
        if (opts.session) query.session(opts.session);
        const lead = await query;

        if (!lead) throw new Error('NOT_FOUND_ERROR: Lead not found');

        const delLeadQuery = Lead.findByIdAndDelete(id);
        if (opts.session) delLeadQuery.session(opts.session);
        await delLeadQuery;

        const delFollowupQuery = LeadFollowup.deleteMany({ leadId: id });
        if (opts.session) delFollowupQuery.session(opts.session);
        await delFollowupQuery;
      };

      await runTransactionWithFallback(
        (session) => performDelete({ session }),
        () => performDelete({})
      );

      await clearAnalyticsCache();
      logAudit('DELETE_LEAD', req, id, { deletedResource: id });

      return res.status(200).json({ success: true, message: 'Lead records clean-purged successfully.' });
    } catch (error) {
      if (error.message?.startsWith('NOT_FOUND_ERROR:')) return res.status(404).json({ success: false, message: error.message.split(': ')[1] });
      if (error.message?.startsWith('FORBIDDEN_ERROR:')) return res.status(403).json({ success: false, message: error.message.split(': ')[1] });
      return res.status(500).json({ success: false, message: 'Failed to delete lead', error: error.message });
    }
  },

  /**
   * POST /api/v1/leads/import
   * Optimizes many writes through rapid standard batch arrays
   */
  importLeads: async (req, res) => {
    try {
      const { leads } = req.body;
      if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ success: false, message: 'No records found to process.' });
      }

      const createdById = req.user?.id || req.user?._id;
      let insertedCount = 0;

      const performImport = async (opts = {}) => {
        const leadRecords = leads.map(item => ({
          leadName: item.leadName || 'Unnamed Lead',
          phone: item.phone ? String(item.phone).replace(/^p:/i, '').trim() : '0000000000',
          email: item.email || '',
          companyName: item.companyName || '',
          city: item.city || '',
          source: item.source || 'Imported Excel',
          interestedService: item.interestedService || '',
          campaignName: item.campaignName || '',
          leadPlatform: item.leadPlatform || '',
          status: item.status || 'New',
          priority: item.priority || 'Medium',
          clientMeetingFixed: item.clientMeetingFixed || '',
          admissionYesNo: item.admissionYesNo || '',
          remarks: item.remarks || 'Imported from Excel spreadsheet.',
          leadsReceivedDate: item.leadsReceivedDate ? new Date(item.leadsReceivedDate) : null,
          followUpDate1: item.followUpDate1 ? new Date(item.followUpDate1) : null,
          followUpDate2: item.followUpDate2 ? new Date(item.followUpDate2) : null,
          followUpDate3: item.followUpDate3 ? new Date(item.followUpDate3) : null,
          followUpDate4: item.followUpDate4 ? new Date(item.followUpDate4) : null,
          followUpDate5: item.followUpDate5 ? new Date(item.followUpDate5) : null,
          createdBy: createdById
        }));

        const insertedLeads = await Lead.insertMany(leadRecords, opts);
        insertedCount = insertedLeads.length;

        const followupRecords = insertedLeads.map(lead => ({
          leadId: lead._id,
          remarks: lead.remarks || 'Lead imported from Excel.',
          statusChangedTo: lead.status,
          createdBy: createdById
        }));

        await LeadFollowup.insertMany(followupRecords, opts);
      };

      await runTransactionWithFallback(
        (session) => performImport({ session }),
        () => performImport({})
      );

      await clearAnalyticsCache();
      logAudit('IMPORT_LEADS', req, 'bulk', { count: insertedCount });

      return res.status(201).json({ success: true, message: `Successfully imported ${insertedCount} leads.` });
    } catch (error) {
      console.error('Error importing leads:', error);
      return res.status(500).json({ success: false, message: 'Failed to import leads', error: error.message });
    }
  },

  /**
   * PUT /api/v1/leads/bulk-update
   * Replaced sequential slow for-loops with high-speed parallel Mongoose bulkWrites
   */
  bulkUpdateStatus: async (req, res) => {
    try {
      const { leadIds, status, lostReason } = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !status) {
        return res.status(400).json({ success: false, message: 'Lead IDs array and destination status fields required.' });
      }

      const userId = req.user?.id || req.user?._id;
      const userRole = String(req.user?.role || req.user?.role_id || '').toLowerCase().trim();
      const isPrivileged = ['1', '2', 'hr', 'admin'].includes(userRole);

      const updatedLeads = [];
      const failedLeads = [];
      const bulkLeadOperations = [];
      const followupRecordsToInsert = [];

      const performBulkUpdate = async (opts = {}) => {
        const validIds = leadIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        const findQuery = Lead.find({ _id: { $in: validIds } });
        if (opts.session) findQuery.session(opts.session);
        const structuralLeadsMap = await findQuery;

        for (const id of leadIds) {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            failedLeads.push({ id, reason: 'Invalid Lead ID structure' });
            continue;
          }

          const currentLead = structuralLeadsMap.find(l => String(l._id) === String(id));
          if (!currentLead) {
            failedLeads.push({ id, reason: 'Lead record missing' });
            continue;
          }

          if (!isPrivileged && String(currentLead.assignedTo) !== String(userId)) {
            failedLeads.push({ id, reason: 'Access Denied (Ownership restriction)' });
            continue;
          }

          const previousStatus = currentLead.status;
          const updateFields = { status };

          if (status === 'Converted' && previousStatus !== 'Converted') {
            updateFields.convertedAt = new Date();
            updateFields.$unset = { lostReason: "" };
          } else if (status === 'Lost') {
            updateFields.lostReason = lostReason || 'Not specified';
            updateFields.$unset = { convertedAt: "" };
          } else {
            updateFields.$unset = { convertedAt: "", lostReason: "" };
          }

          bulkLeadOperations.push({
            updateOne: {
              filter: { _id: id },
              update: updateFields
            }
          });

          followupRecordsToInsert.push({
            leadId: id,
            remarks: `Bulk status update from "${previousStatus}" to "${status}".`,
            statusChangedTo: status,
            nextFollowUpDate: currentLead.nextFollowUpDate,
            createdBy: userId
          });

          updatedLeads.push(id);
        }

        if (bulkLeadOperations.length > 0) {
          await Lead.bulkWrite(bulkLeadOperations, opts);
          await LeadFollowup.insertMany(followupRecordsToInsert, opts);
        }
      };

      await runTransactionWithFallback(
        (session) => performBulkUpdate({ session }),
        () => performBulkUpdate({})
      );

      await clearAnalyticsCache();
      logAudit('BULK_STATUS_UPDATE', req, 'bulk', { updatedCount: updatedLeads.length });

      return res.status(200).json({
        success: true,
        message: `Bulk update complete. successfully processed ${updatedLeads.length} leads.`,
        updatedCount: updatedLeads.length,
        updatedLeads,
        failedLeads
      });
    } catch (error) {
      console.error('Error executing bulk state variations:', error);
      return res.status(500).json({ success: false, message: 'Failed operational pipeline execution.', error: error.message });
    }
  }
};