import GraphicDesignerReport from '../models/graphicDesignerReport.model.js';
import User from '../models/user.model.js';

/**
 * 1. GET REPORT BY DATE
 * GET /api/v1/graphic-designer-reports/by-date?dateString=YYYY-MM-DD&userId=...
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

    const isGraphicDesigner = desigName.includes('graphic') || desigName.includes('designer');

    // If userId is provided, verify permissions
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged && !isGraphicDesigner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own reports.'
        });
      }
    } else {
      targetUserId = currentUserId;
    }

    const report = await GraphicDesignerReport.findOne({
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
 * POST /api/v1/graphic-designer-reports
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

    const isGraphicDesigner = desigName.includes('graphic') || desigName.includes('designer');

    // If targetUserId is provided, check if client has rights to save on behalf of that user
    if (targetUserId) {
      if (targetUserId !== String(currentUserId) && !isPrivileged && !isGraphicDesigner) {
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
      taskLog: req.body.taskLog || [],
      teamLeadKpi: req.body.teamLeadKpi || [],
      keyNumbers: req.body.keyNumbers || {},
      blockers: req.body.blockers || [],
      tomorrowTasks: req.body.tomorrowTasks || [],
      approval: req.body.approval,
      excludedSections: req.body.excludedSections || [],
      hiddenSections: req.body.hiddenSections || {}
    };

    const report = await GraphicDesignerReport.findOneAndUpdate(
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
 * 3. GET DESIGNERS LIST (For HR/Admin dropdown selection)
 * GET /api/v1/graphic-designer-reports/designers
 */
export const getDesignersList = async (req, res, next) => {
  try {
    const Designation = (await import('../models/designation.model.js')).default;
    const gdDesigs = await Designation.find({ name: /graphic|designer|ui|ux/i }).select('_id');
    const gdDesigIds = gdDesigs.map(d => d._id);

    const designers = await User.find({
      $or: [
        { designationId: { $in: gdDesigIds } },
        { designation_id: { $in: gdDesigIds.map(id => String(id)) } },
        { designation: /graphic|designer|ui|ux/i }
      ]
    }, '_id name employeeId email designation')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: designers
    });
  } catch (error) {
    console.error('Error in getDesignersList:', error);
    next(error);
  }
};

/**
 * 4. GET SUBMITTED DATES
 * GET /api/v1/graphic-designer-reports/submitted-dates?userId=...
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

    const reports = await GraphicDesignerReport.find({ userId: targetUserId }, 'dateString');
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
