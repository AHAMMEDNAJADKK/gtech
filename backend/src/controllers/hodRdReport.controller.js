import HodRdReport from '../models/hodRdReport.model.js';
import User from '../models/user.model.js';

/**
 * 1. GET REPORT BY DATE
 * GET /api/v1/hod-rd-reports/by-date?dateString=YYYY-MM-DD&userId=...
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

    const report = await HodRdReport.findOne({
      userId: targetUserId,
      dateString: dateString
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily shift report not found for this date.'
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
 * 2. SAVE OR UPDATE REPORT (UPSERT)
 * POST /api/v1/hod-rd-reports
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
      dailyTaskSummary: req.body.dailyTaskSummary || [],
      developmentWorkReport: req.body.developmentWorkReport || [],
      rdInnovationReport: req.body.rdInnovationReport || [],
      kpiTracking: req.body.kpiTracking || [],
      issuesSupportRequired: req.body.issuesSupportRequired || [],
      nextDayPlanning: req.body.nextDayPlanning,
      hodComments: req.body.hodComments,
      approval: req.body.approval,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {}
    };

    const report = await HodRdReport.findOneAndUpdate(
      { userId: targetUserId, dateString },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Daily shift report saved successfully.',
      data: report
    });
  } catch (error) {
    console.error('Error in saveReport:', error);
    next(error);
  }
};

/**
 * 3. GET HOD LIST (For HR/Admin dropdown selection)
 * GET /api/v1/hod-rd-reports/hods
 */
export const getHodsList = async (req, res, next) => {
  try {
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Exclusive to Admins and HR.'
      });
    }

    const Designation = (await import('../models/designation.model.js')).default;
    const hodDesigs = await Designation.find({ name: /hod|r&d|research/i }).select('_id');
    const hodDesigIds = hodDesigs.map(d => d._id);

    const hods = await User.find({
      $or: [
        { designationId: { $in: hodDesigIds } },
        { designation_id: { $in: hodDesigIds.map(id => String(id)) } },
        { designation: /hod|r&d|research/i }
      ]
    }, '_id name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: hods
    });
  } catch (error) {
    console.error('Error in getHodsList:', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED DATES
 * GET /api/v1/hod-rd-reports/submitted-dates?userId=...
 */
export const getSubmittedDates = async (req, res, next) => {
  try {
    let targetUserId = req.query.userId;
    const currentUserId = req.user.id || req.user._id;
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

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

    const reports = await HodRdReport.find({ userId: targetUserId }, 'dateString');
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
