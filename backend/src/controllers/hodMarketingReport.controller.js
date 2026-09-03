import mongoose from 'mongoose';
import HodMarketingReport from '../models/hodMarketingReport.model.js';
import User from '../models/user.model.js';
import EmployeeReports from '../models/employeeReports.model.js';

/**
 * 1. GET REPORT BY DATE
 * GET /api/v1/hod-marketing-reports/by-date?dateString=YYYY-MM-DD&userId=...
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

    const report = await HodMarketingReport.findOne({
      userId: targetUserId,
      dateString: dateString
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'HOD Marketing daily shift report not found for this date.'
      });
    }

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in getReportByDate (HOD Marketing):', error);
    next(error);
  }
};

/**
 * 2. SAVE OR UPDATE REPORT (UPSERT)
 * POST /api/v1/hod-marketing-reports
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
      reportPeriod: req.body.reportPeriod || 'daily',
      basicDetails: req.body.basicDetails,
      kpiSummary: req.body.kpiSummary || {},
      dailyTaskSummary: req.body.dailyTaskSummary || [],
      tasksAssignedByUser: req.body.tasksAssignedByUser || [],
      kpiTracking: req.body.kpiTracking || [],
      marketingCampaigns: req.body.marketingCampaigns || [],
      graphicDesignTasks: req.body.graphicDesignTasks || [],
      videoDeliverables: req.body.videoDeliverables || [],
      blockersTomorrowPlan: req.body.blockersTomorrowPlan || [],
      excludeTables: req.body.excludeTables === true,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {},
      approval: req.body.approval || {}
    };

    const report = await HodMarketingReport.findOneAndUpdate(
      { userId: targetUserId, dateString },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'HOD Marketing shift report saved successfully.',
      data: report
    });
  } catch (error) {
    console.error('Error in saveReport (HOD Marketing):', error);
    next(error);
  }
};

/**
 * 3. GET HOD MARKETING USERS LIST
 * GET /api/v1/hod-marketing-reports/hods
 */
export const getHodsList = async (req, res, next) => {
  try {
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only managers, HR, and admins can view team member lists.'
      });
    }

    const hodUserIds = await HodMarketingReport.distinct('userId');
    const hods = await User.find(
      { _id: { $in: hodUserIds } },
      'name email designation designationName department departmentName employee_id'
    ).lean();

    return res.status(200).json({
      success: true,
      data: hods
    });
  } catch (error) {
    console.error('Error in getHodsList (HOD Marketing):', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED REPORT DATES FOR A USER
 * GET /api/v1/hod-marketing-reports/submitted-dates?userId=...
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
          message: 'Access denied.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    let reportQuery = { userId: targetUserId };
    let empQuery = { employee_id: targetUserId };
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      const objId = new mongoose.Types.ObjectId(targetUserId);
      reportQuery = { $or: [{ userId: objId }, { userId: String(targetUserId) }] };
      empQuery = { $or: [{ employee_id: objId }, { employee_id: String(targetUserId) }] };
    }

    const [reports, employeeReports] = await Promise.all([
      HodMarketingReport.find(reportQuery, 'dateString').lean(),
      EmployeeReports.find(empQuery, 'report_date').lean()
    ]);

    const dates = reports.map(r => r.dateString).filter(Boolean);
    const empDates = employeeReports.map(r => r.report_date).filter(Boolean);

    const allSubmittedDates = Array.from(new Set([...dates, ...empDates]));

    return res.status(200).json({
      success: true,
      data: allSubmittedDates
    });
  } catch (error) {
    console.error('Error in getSubmittedDates (HOD Marketing):', error);
    next(error);
  }
};

/**
 * 5. GET REPORTS BY DATE RANGE
 * GET /api/v1/hod-marketing-reports/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&userId=...
 */
export const getReportsByRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let targetUserId = req.query.userId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate parameters are required (YYYY-MM-DD)'
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

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

    const reports = await HodMarketingReport.find({
      userId: targetUserId,
      dateString: { $gte: startDate, $lte: endDate }
    }).sort({ dateString: 1 });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error in getReportsByRange (HOD Marketing):', error);
    next(error);
  }
};
