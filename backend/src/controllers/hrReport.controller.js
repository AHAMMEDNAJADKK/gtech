import HrReport from '../models/hrReport.model.js';
import User from '../models/user.model.js';

/**
 * 1. GET HR REPORT BY DATE
 * GET /api/v1/hr-reports/by-date?dateString=YYYY-MM-DD&userId=...
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

    const report = await HrReport.findOne({
      userId: targetUserId,
      dateString: dateString
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'HR daily shift report not found for this date.'
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
 * 2. SAVE OR UPDATE HR REPORT (UPSERT)
 * POST /api/v1/hr-reports
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
      employeeManagement: req.body.employeeManagement || [],
      recruitmentReport: req.body.recruitmentReport || [],
      attendanceLeave: req.body.attendanceLeave || [],
      adminOperations: req.body.adminOperations || [],
      documentationCompliance: req.body.documentationCompliance || [],
      kpiTracking: req.body.kpiTracking || [],
      issuesEscalations: req.body.issuesEscalations || [],
      nextDayActionPlan: req.body.nextDayActionPlan,
      finalShiftHandover: req.body.finalShiftHandover || [],
      hrAdminComments: req.body.hrAdminComments,
      approval: req.body.approval,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {}
    };

    const report = await HrReport.findOneAndUpdate(
      { userId: targetUserId, dateString },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'HR daily shift report saved successfully.',
      data: report
    });
  } catch (error) {
    console.error('Error in saveReport:', error);
    next(error);
  }
};

/**
 * 3. GET HR STAFF LIST (For HR/Admin dropdown selection)
 * GET /api/v1/hr-reports/hr-staff
 */
export const getHrStaffList = async (req, res, next) => {
  try {
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Exclusive to Admins and HR Management.'
      });
    }

    const Designation = (await import('../models/designation.model.js')).default;
    const hrDesigs = await Designation.find({ name: /hr|admin|recruiter/i }).select('_id');
    const hrDesigIds = hrDesigs.map(d => d._id);

    const hrStaff = await User.find({
      $or: [
        { designationId: { $in: hrDesigIds } },
        { designation_id: { $in: hrDesigIds.map(id => String(id)) } },
        { designation: /hr|admin|recruiter/i },
        { role: 'hr' }
      ]
    }, '_id name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: hrStaff
    });
  } catch (error) {
    console.error('Error in getHrStaffList:', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED DATES
 * GET /api/v1/hr-reports/submitted-dates?userId=...
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

    const reports = await HrReport.find({ userId: targetUserId }, 'dateString');
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
