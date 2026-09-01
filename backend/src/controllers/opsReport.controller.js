import OpsReport from '../models/opsReport.model.js';
import User from '../models/user.model.js';
import Lead from '../models/lead.model.js';
import LeadFollowup from '../models/leadFollowup.model.js';
import ClientLead from '../models/clientLead.model.js';

/**
 * 1. GET OPERATIONS REPORT BY DATE
 * GET /api/v1/ops-reports/by-date?dateString=YYYY-MM-DD&userId=...
 */
export const getReportByDate = async (req, res, next) => {
  try {
    const { dateString } = req.query;
    let targetUserId = req.query.userId;

    if (!dateString) {
      return res.status(400).json({
        success: false,
        message: 'dateString parameter is required (format: YYYY-MM-DD)'
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    // If userId is provided, verify permissions
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own reports.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const report = await OpsReport.findOne({
      userId: targetUserId,
      dateString: dateString
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Operations daily shift report not found for this date.'
      });
    }

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in getReportByDate:', error);
    next(error);
  }
};

/**
 * 2. SAVE OR UPDATE OPERATIONS REPORT (UPSERT)
 * POST /api/v1/ops-reports
 */
export const saveReport = async (req, res, next) => {
  try {
    const { dateString } = req.body;
    let targetUserId = req.body.userId;

    if (!dateString) {
      return res.status(400).json({
        success: false,
        message: 'dateString is required'
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    // If targetUserId is provided, check if client has rights to save on behalf of that user
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You cannot save reports for other users.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const updateData = {
      userId: targetUserId,
      dateString,
      basicDetails: req.body.basicDetails,
      dailyOperations: req.body.dailyOperations || [],
      salesActivity: req.body.salesActivity || [],
      salesPerformance: req.body.salesPerformance || [],
      revenueTracking: req.body.revenueTracking || [],
      academyStatus: req.body.academyStatus || [],
      kpiTracking: req.body.kpiTracking || [],
      issuesEscalations: req.body.issuesEscalations || [],
      handover: req.body.handover,
      approval: req.body.approval,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {}
    };

    const report = await OpsReport.findOneAndUpdate(
      { userId: targetUserId, dateString },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Operations daily shift report saved successfully.',
      data: report
    });
  } catch (error) {
    console.error('Error in saveReport:', error);
    next(error);
  }
};

/**
 * 3. GET OPERATIONS STAFF LIST (For HR/Admin dropdown selection)
 * GET /api/v1/ops-reports/ops-staff
 */
export const getOpsStaffList = async (req, res, next) => {
  try {
    const currentUserRole = String(req.user.role || req.user.role_id || '').toLowerCase().trim();
    const isPrivileged = ['1', '2', 'hr', 'admin'].includes(currentUserRole);

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Exclusive to Admins and Management.'
      });
    }

    const Designation = (await import('../models/designation.model.js')).default;
    const opsDesigs = await Designation.find({ name: /ops|operation|sales|growth|counselor|telecaller/i }).select('_id');
    const opsDesigIds = opsDesigs.map(d => d._id);

    const opsStaff = await User.find({
      $or: [
        { designationId: { $in: opsDesigIds } },
        { designation_id: { $in: opsDesigIds.map(id => String(id)) } },
        { designation: /ops|operation|sales|growth|counselor|telecaller/i }
      ]
    }, '_id name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: opsStaff
    });
  } catch (error) {
    console.error('Error in getOpsStaffList:', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED DATES
 * GET /api/v1/ops-reports/submitted-dates?userId=...
 */
export const getSubmittedDates = async (req, res, next) => {
  try {
    let targetUserId = req.query.userId;
    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = String(req.user.role || req.user.role_id || '').toLowerCase().trim();
    const isPrivileged = ['1', '2', 'hr', 'admin'].includes(currentUserRole);

    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You cannot view report dates for other users.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const reports = await OpsReport.find({ userId: targetUserId }, 'dateString');
    const dates = reports.map(r => r.dateString);

    return res.status(200).json({
      success: true,
      data: dates
    });
  } catch (error) {
    console.error('Error in getSubmittedDates:', error);
    next(error);
  }
};

/**
 * 5. GET LEAD STATS FOR OPS DAILY REPORT
 * GET /api/v1/ops-reports/lead-stats?date=YYYY-MM-DD
 * Auto-fetches lead counts from the CRM for the Daily Course Counseling & Sales Activity table.
 * Captures both newly created leads AND leads whose course interest was updated on the report date.
 */
export const getLeadStats = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date parameter is required (YYYY-MM-DD)' });
    }

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayRange = { $gte: dayStart, $lte: dayEnd };

    // 1. New leads created on this date
    const newLeadsToday = await Lead.find({ createdAt: dayRange }).lean();
    const totalNewLeads = newLeadsToday.length;

    // 2. Leads updated on this date (includes course interest changes)
    //    Fetch leads that were updated today but NOT created today (to avoid double-counting)
    const updatedLeadsToday = await Lead.find({
      updatedAt: dayRange,
      createdAt: { $lt: dayStart }   // exclude leads already counted as new
    }).lean();

    // 3. Combined set: all leads that had activity on this date
    const allActiveLeads = [...newLeadsToday, ...updatedLeadsToday];

    // 4. Count by interestedService category (from ALL active leads)
    const categoryCount = (category) =>
      allActiveLeads.filter(l => (l.interestedService || '').toUpperCase().trim() === category.toUpperCase()).length;

    const hotLeads = categoryCount('HOT LEAD');
    const warmLeads = categoryCount('WARM LEAD');
    const coldLeads = categoryCount('COLD LEAD');
    const callBackLeads = categoryCount('CALL BACK');
    const rntLeads = categoryCount('RNT');
    const switchedOffLeads = categoryCount('SWITCHED OFF');
    const wrongLeads = categoryCount('WRONG LEAD');

    // 5. Qualified leads = Interested + Converted (from active leads)
    const qualifiedLeads = allActiveLeads.filter(l => ['Interested', 'Converted'].includes(l.status)).length;

    // 6. Total follow-up calls made today (from LeadFollowup collection)
    const followUpsToday = await LeadFollowup.countDocuments({ createdAt: dayRange });

    // 7. Total calls = new leads + follow-ups
    const totalCalls = totalNewLeads + followUpsToday;

    // 8. Pending follow-ups (status = 'Follow Up' and nextFollowUpDate exists — cumulative)
    const pendingFollowUps = await Lead.countDocuments({
      status: 'Follow Up',
      nextFollowUpDate: { $exists: true, $ne: null }
    });

    // 9. Total pending leads (status = 'New' or 'Contacted' — cumulative)
    const pendingLeads = await Lead.countDocuments({
      status: { $in: ['New', 'Contacted'] }
    });

    // 10. Client meetings fixed (from active leads)
    const meetingsFixed = allActiveLeads.filter(l => l.clientMeetingFixed === 'Yes').length;

    // 11. Admissions / closings done (from active leads)
    const admissionsDone = allActiveLeads.filter(l => l.admissionYesNo === 'Yes').length;

    // 12. Source channel breakdown for Digital Mktg vs Web (new leads only)
    const digitalMktgSources = ['facebook', 'instagram', 'google ads', 'meta', 'social media', 'digital', 'fb', 'ig'];
    const webSources = ['website', 'web', 'landing page', 'seo', 'organic'];

    const countBySource = (leads, sources) =>
      leads.filter(l => {
        const src = (l.source || '').toLowerCase().trim();
        const platform = (l.leadPlatform || '').toLowerCase().trim();
        return sources.some(s => src.includes(s) || platform.includes(s));
      }).length;

    const totalDigital = countBySource(newLeadsToday, digitalMktgSources);
    const totalWeb = countBySource(newLeadsToday, webSources);

    // Build the salesActivity array matching the OPS report structure
    const salesActivity = [
      { activity: 'New Leads Generated', count: String(totalNewLeads), digitalMktg: String(totalDigital), web: String(totalWeb), dueDate: '', remarks: '' },
      { activity: 'Qualified Lead', count: String(qualifiedLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Calls Made', count: String(totalCalls), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Follow up', count: String(followUpsToday), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Hot Leads', count: String(hotLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Warm Leads', count: String(warmLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Cold Leads', count: String(coldLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Call back Leads', count: String(callBackLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'RNT Leads (Ring Next Time)', count: String(rntLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Switch Off Leads', count: String(switchedOffLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Wrong leads', count: String(wrongLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Pending Follow-ups', count: String(pendingFollowUps), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Pending Leads', count: String(pendingLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Client/Student Meetings Fixed', count: String(meetingsFixed), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Admissions/Closings Done', count: String(admissionsDone), digitalMktg: '', web: '', dueDate: '', remarks: '' }
    ];

    return res.status(200).json({ success: true, data: salesActivity });
  } catch (error) {
    console.error('Error in getLeadStats:', error);
    next(error);
  }
};

/**
 * 6. GET CLIENT LEAD STATS FOR REPORT
 * GET /api/v1/ops-reports/client-lead-stats?date=YYYY-MM-DD
 * Auto-fetches client lead counts from ClientLead for Daily Client Leads Activity table.
 */
export const getClientLeadStats = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date parameter is required (YYYY-MM-DD)' });
    }

    const matchesDate = (d) => {
      if (!d) return false;
      try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return false;
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const localDate = `${y}-${m}-${day}`;
        const utcY = dateObj.getUTCFullYear();
        const utcM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const utcD = String(dateObj.getUTCDate()).padStart(2, '0');
        const utcDate = `${utcY}-${utcM}-${utcD}`;
        return localDate === date || utcDate === date;
      } catch (e) {
        return false;
      }
    };

    const allClientLeads = await ClientLead.find({}).lean();

    // Combined search string per lead across priority, service, interest, status, and remarks
    const getCombinedTags = (l) => `${l.priority || ''} ${l.interestedService || ''} ${l.courseIntrests || ''} ${l.courseInterests || ''} ${l.status || ''} ${l.remarks || ''}`.toLowerCase();

    // STRICT DATE FILTER: Only count client leads created, received, or updated TODAY (on report date)
    const leadsActiveToday = allClientLeads.filter(l => 
      matchesDate(l.createdAt) || 
      matchesDate(l.leadsReceivedDate) || 
      matchesDate(l.updatedAt) ||
      matchesDate(l.followUpDate1) || 
      matchesDate(l.followUpDate2) || 
      matchesDate(l.followUpDate3) || 
      matchesDate(l.followUpDate4) || 
      matchesDate(l.followUpDate5)
    );

    // 1. New client leads created/received on date
    const newClientLeadsToday = allClientLeads.filter(l => 
      matchesDate(l.createdAt) || matchesDate(l.leadsReceivedDate)
    );
    const totalNewClientLeads = newClientLeadsToday.length;

    // 2. Qualified client leads updated today (Interested or Converted)
    const qualifiedClientLeads = leadsActiveToday.filter(l => {
      const tags = getCombinedTags(l);
      return tags.includes('interested') || tags.includes('convert');
    }).length;

    // 3. Total Client Calls / Contacted today (Total leads worked on / updated today)
    const totalContacted = leadsActiveToday.length;

    // 4. Total Client Follow ups today
    const totalFollowUps = leadsActiveToday.filter(l => {
      const tags = getCombinedTags(l);
      return tags.includes('follow') || matchesDate(l.followUpDate1) || matchesDate(l.followUpDate2) || matchesDate(l.followUpDate3) || matchesDate(l.followUpDate4) || matchesDate(l.followUpDate5);
    }).length;

    // 5. Priority counts for leads updated today ("HOT LEAD", "HOT", "HIGH", "WARM LEAD", "MEDIUM", "COLD LEAD", "LOW")
    const getLeadPriorityCategory = (l) => {
      const interestVal = String(l.interestedService || l.courseIntrests || l.courseInterests || '').trim().toLowerCase();
      const priorityVal = String(l.priority || '').trim().toLowerCase();

      // Check explicit interest dropdown tag first (as rendered in Client Leads table pills)
      if (interestVal.includes('hot') || interestVal.includes('high')) return 'HOT';
      if (interestVal.includes('warm') || interestVal.includes('med')) return 'WARM';
      if (interestVal.includes('cold') || interestVal.includes('low')) return 'COLD';

      // Check priority field ONLY if explicitly tagged hot/warm/cold (ignoring schema default Medium)
      if (priorityVal.includes('hot')) return 'HOT';
      if (priorityVal.includes('warm')) return 'WARM';
      if (priorityVal.includes('cold')) return 'COLD';

      return 'OTHER';
    };

    const hotClientLeads = leadsActiveToday.filter(l => getLeadPriorityCategory(l) === 'HOT').length;
    const warmClientLeads = leadsActiveToday.filter(l => getLeadPriorityCategory(l) === 'WARM').length;
    const coldClientLeads = leadsActiveToday.filter(l => getLeadPriorityCategory(l) === 'COLD').length;

    // 6. Total pending client leads updated today
    const pendingClientLeads = leadsActiveToday.filter(l => {
      const tags = getCombinedTags(l);
      return tags.includes('new') || tags.includes('contact') || tags.includes('follow') || (!tags.includes('convert') && !tags.includes('lost'));
    }).length;

    // 7. Client Meetings Fixed today
    const meetingsFixed = leadsActiveToday.filter(l => {
      const m = String(l.clientMeetingFixed || '').toLowerCase();
      const tags = getCombinedTags(l);
      return m === 'yes' || m === 'fixed' || m === 'done' || tags.includes('meeting fixed');
    }).length;

    // 8. Client Closings / Onboarding Done today
    const closingsDone = leadsActiveToday.filter(l => {
      const o = String(l.clientOnboarding || '').toLowerCase();
      const tags = getCombinedTags(l);
      return o === 'yes' || tags.includes('convert') || tags.includes('closed') || tags.includes('onboard');
    }).length;

    // 9. Digital Mktg vs Web source breakdown for leads created/active today
    const digitalMktgSources = ['facebook', 'instagram', 'google ads', 'meta', 'social media', 'digital', 'fb', 'ig', 'marketing'];
    const webSources = ['website', 'web', 'landing page', 'seo', 'organic'];

    const countBySource = (leads, sources) =>
      leads.filter(l => {
        const src = String(l.source || '').toLowerCase().trim();
        const platform = String(l.leadPlatform || '').toLowerCase().trim();
        return sources.some(s => src.includes(s) || platform.includes(s));
      }).length;

    const targetForSource = newClientLeadsToday.length > 0 ? newClientLeadsToday : leadsActiveToday;
    const totalDigital = countBySource(targetForSource, digitalMktgSources);
    const totalWeb = countBySource(targetForSource, webSources);

    const clientSalesActivity = [
      { activity: 'New Client Leads Generated', count: String(totalNewClientLeads), digitalMktg: String(totalDigital), web: String(totalWeb), dueDate: '', remarks: '' },
      { activity: 'Qualified Client Leads', count: String(qualifiedClientLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Client Calls / Contacted', count: String(totalContacted), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Client Follow ups', count: String(totalFollowUps), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Hot Client Leads (High Priority)', count: String(hotClientLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Warm Client Leads (Medium Priority)', count: String(warmClientLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Cold Client Leads (Low Priority)', count: String(coldClientLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Total Pending Client Leads', count: String(pendingClientLeads), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Client Meetings Fixed', count: String(meetingsFixed), digitalMktg: '', web: '', dueDate: '', remarks: '' },
      { activity: 'Client Closings / Onboarding Done', count: String(closingsDone), digitalMktg: '', web: '', dueDate: '', remarks: '' }
    ];

    return res.status(200).json({ success: true, data: clientSalesActivity });
  } catch (error) {
    console.error('Error in getClientLeadStats:', error);
    next(error);
  }
};
