import AcademicCounselorReport from '../models/academicCounselorReport.model.js';
import User from '../models/user.model.js';

/**
 * 1. GET REPORT BY DATE
 * GET /api/v1/academic-counselor-reports/by-date?dateString=YYYY-MM-DD&userId=...
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

    // Fetch current user from DB to check designation
    let desigName = '';
    try {
      const userObj = await User.findById(currentUserId).populate('designationId');
      if (userObj) {
        desigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();
      }
    } catch (err) {
      console.error('Failed to fetch current user designation:', err);
    }

    const isCounselor = desigName.includes('counselor') || desigName.includes('academic');

    // If userId is provided, verify permissions
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged && !isCounselor) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own reports.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const report = await AcademicCounselorReport.findOne({
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
 * POST /api/v1/academic-counselor-reports
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

    // Fetch current user from DB to check designation
    let userDesignationId = '';
    let desigName = '';
    try {
      const userObj = await User.findById(currentUserId).populate('designationId');
      if (userObj) {
        userDesignationId = String(userObj.designationId?._id || userObj.designationId || userObj.designation_id || '');
        desigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase();
      }
    } catch (err) {
      console.error('Failed to fetch current user designation:', err);
    }

    const isCounselor = desigName.includes('counselor') || desigName.includes('academic') || desigName.includes('tele');

    // If targetUserId is provided, check if client has rights to save on behalf of that user
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged && !isCounselor) {
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
      salesActivity: req.body.salesActivity || [],
      clientSalesActivity: req.body.clientSalesActivity || [],
      dailyOperations: req.body.dailyOperations || [],
      reportsCollectedDone: req.body.reportsCollectedDone || false,
      performanceKpis: req.body.performanceKpis || [],
      issuesFeedback: req.body.issuesFeedback || [],
      finalHandover: req.body.finalHandover || {},
      approval: req.body.approval,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {}
    };

    const report = await AcademicCounselorReport.findOneAndUpdate(
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
 * 3. GET COUNSELORS LIST (For selection dropdown)
 * GET /api/v1/academic-counselor-reports/counselors
 */
export const getCounselorsList = async (req, res, next) => {
  try {
    const Designation = (await import('../models/designation.model.js')).default;
    const acDesigs = await Designation.find({ name: /counselor|academic|tele/i }).select('_id');
    const acDesigIds = acDesigs.map(d => d._id);

    const counselors = await User.find({
      $or: [
        { designationId: { $in: acDesigIds } },
        { designation_id: { $in: acDesigIds.map(id => String(id)) } },
        { designation: /counselor|academic|tele/i }
      ]
    }, '_id name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: counselors
    });
  } catch (error) {
    console.error('Error in getCounselorsList:', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED DATES
 * GET /api/v1/academic-counselor-reports/submitted-dates?userId=...
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

    const reports = await AcademicCounselorReport.find({ userId: targetUserId }, 'dateString');
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
 * 5. GET REPORTS BY RANGE (For Weekly / Monthly Consolidation)
 * GET /api/v1/academic-counselor-reports/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&userId=...
 */
export const getReportsByRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let targetUserId = req.query.userId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate parameters are required'
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const roleStr = String(req.user?.role || '').toLowerCase().trim();
    const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isPrivileged = req.user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

    let desigName = '';
    try {
      const userObj = await User.findById(currentUserId).populate('designationId');
      if (userObj) {
        userDesignationId = String(userObj.designationId?._id || userObj.designationId || userObj.designation_id || '');
        desigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase();
      }
    } catch (err) {}

    const isCounselor = desigName.includes('counselor') || desigName.includes('academic') || desigName.includes('tele');

    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged && !isCounselor) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own reports.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const reports = await AcademicCounselorReport.find({
      userId: targetUserId,
      dateString: { $gte: startDate, $lte: endDate }
    }).sort({ dateString: 1 });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error in getReportsByRange:', error);
    next(error);
  }
};
