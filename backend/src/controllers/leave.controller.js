import mongoose from 'mongoose';
import LeaveRequest from '../models/leaveRequest.model.js';
import User from '../models/user.model.js';
import { sendNotification } from '../services/notification.service.js';
import socketService from '../services/socket.service.js';

/**
 * Helper to check if a user is SuperAdmin
 */
const isSuperAdminUser = (userObj) => {
  if (!userObj) return false;
  const role = String(userObj.role || '').toLowerCase().trim();
  const roleId = String(userObj.role_id || userObj.roleId || '').trim();
  const desig = String(userObj.designation || '').toLowerCase().trim();

  return (
    userObj.isSuperAdmin === true ||
    role === 'superadmin' ||
    role === 'md' ||
    roleId === '0' ||
    roleId === 'md' ||
    desig === 'md' ||
    desig.includes('managing director') ||
    desig.includes('md')
  );
};

/**
 * Helper to fetch SuperAdmin/MD user IDs
 */
const getSuperAdminUserIds = async () => {
  try {
    const superUsers = await User.find({
      $or: [
        { isSuperAdmin: true },
        { role_id: '0' },
        { role_id: 'md' },
        { role: 'superadmin' },
        { role: 'md' },
        { designation: { $regex: /md|managing director/i } }
      ]
    }).select('_id');
    return superUsers.map(u => u._id);
  } catch (err) {
    console.error('Error fetching SuperAdmin users:', err);
    return [];
  }
};

/**
 * Helper to check if a user has HR/Admin privileges
 */
const isHrOrAdmin = (userObj) => {
  if (!userObj) return false;
  const role = String(userObj.role || '').toLowerCase().trim();
  const roleId = String(userObj.role_id || userObj.roleId || '').trim();
  const dept = String(userObj.department || '').toLowerCase().trim();
  const desig = String(userObj.designation || '').toLowerCase().trim();

  return (
    userObj.isSuperAdmin === true ||
    role === 'superadmin' ||
    role === 'admin' ||
    role === 'hr' ||
    roleId === '0' ||
    roleId === '1' ||
    roleId === '2' ||
    dept.includes('hr') ||
    dept.includes('admin') ||
    desig.includes('hr')
  );
};

/**
 * Helper to check if a user is a Team Lead / Manager
 */
const isTlOrManager = async (userObj) => {
  if (!userObj) return false;
  
  // 1. Explicit check on user model boolean flags (authoritative)
  if (userObj.isTeamLead === false || userObj.is_team_lead === false || String(userObj.isTeamLead).toLowerCase() === 'false' || String(userObj.is_team_lead).toLowerCase() === 'false') {
    return false;
  }

  if (userObj.isTeamLead === true || userObj.is_team_lead === true || String(userObj.isTeamLead).toLowerCase() === 'true' || String(userObj.is_team_lead).toLowerCase() === 'true') {
    return true;
  }

  // 2. Check if user is assigned as manager of any department
  try {
    const Department = (await import('../modules/departments/department.model.js')).default;
    if (Department && userObj._id) {
      const isDeptManager = await Department.exists({ managerId: userObj._id });
      if (isDeptManager) return true;
    }
  } catch (e) {
    console.warn('Error checking department manager status:', e.message);
  }

  // 3. Fallback check ONLY on explicit role strings (strictly excluding role_id: 3 default staff)
  const role = String(userObj.role || '').toLowerCase().trim();
  return ['manager', 'team_lead', 'teamlead', 'tl', 'hod'].includes(role);
};

/**
 * Helper to fetch HR/Admin user IDs for targeted notifications
 */
const getHrUserIds = async () => {
  try {
    const hrUsers = await User.find({
      $or: [
        { isSuperAdmin: true },
        { role_id: { $in: ['0', '1', '2'] } },
        { role: { $in: ['admin', 'hr', 'superadmin'] } },
        { department: { $regex: /hr|admin/i } },
        { designation: { $regex: /hr/i } }
      ]
    }).select('_id');
    return hrUsers.map(u => u._id);
  } catch (err) {
    console.error('Error fetching HR users for notification:', err);
    return [];
  }
};

/**
 * Helper to find Team Lead User ID by manager name
 */
const getTeamLeadUserId = async (managerName) => {
  if (!managerName || typeof managerName !== 'string' || managerName.trim() === '' || managerName.toLowerCase() === 'unassigned') {
    return null;
  }
  try {
    const cleanName = managerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const leadUser = await User.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
    }).select('_id');
    return leadUser ? leadUser._id : null;
  } catch (err) {
    console.error('Error finding team lead by name:', err);
    return null;
  }
};

/**
 * Helper to enrich leave requests with actual user department and team lead from Department manager
 */
const enrichLeaveList = (leaves) => {
  if (!Array.isArray(leaves)) return [];
  return leaves.map(leave => {
    const l = leave?.toObject ? leave.toObject() : { ...leave };
    const deptName = l.user?.departmentId?.name || l.user?.department || (l.department && l.department.trim() ? l.department : 'General');
    const deptManagerName = l.user?.departmentId?.managerId?.name;
    const tlName = deptManagerName || l.user?.reportingManager || l.reportingManager || '';

    return {
      ...l,
      department: deptName,
      reportingManager: tlName,
      teamLeadName: tlName
    };
  });
};

/**
 * @desc Submit a new Leave Request
 * @route POST /api/leaves
 * @access Protected
 */
export const createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, ccUserIds } = req.body;
    const userId = req.user?.id || req.user?._id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required.' });
    }

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, start date, end date, and reason are required.'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date or end date format.'
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be earlier than start date.'
      });
    }

    // Calculate total days
    let totalDays = 1;
    if (leaveType === 'Half Day') {
      totalDays = 0.5;
    } else {
      const diffTime = Math.abs(end - start);
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Fetch employee details from DB for accurate metadata
    const userObj = await User.findById(userId);
    if (!userObj) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    // Resolve CC Users safely
    let resolvedCcUsers = [];
    if (Array.isArray(ccUserIds) && ccUserIds.length > 0) {
      const validCcIds = ccUserIds.filter(id => id && mongoose.Types.ObjectId.isValid(id));
      if (validCcIds.length > 0) {
        const ccDocs = await User.find({ _id: { $in: validCcIds } }).select('_id name email');
        resolvedCcUsers = ccDocs.map(u => ({
          userId: u._id,
          name: u.name,
          email: u.email
        }));
      }
    }


    const requesterIsTl = await isTlOrManager(userObj);
    const requesterIsHr = isHrOrAdmin(userObj);
    const skipTeamLeadStage = requesterIsTl || requesterIsHr;

    const initialTeamLeadStatus = skipTeamLeadStage ? 'APPROVED' : 'PENDING';
    const initialTeamLeadActionBy = skipTeamLeadStage ? userId : undefined;
    const initialTeamLeadActionAt = skipTeamLeadStage ? new Date() : undefined;
    const initialTeamLeadComment = skipTeamLeadStage 
      ? (requesterIsHr ? 'Bypassed (Requester is HR)' : 'Auto-approved (Requester is Team Lead)') 
      : undefined;

    let userDeptName = userObj.department || '';
    let userTeamLeadName = userObj.reportingManager || '';

    if (userObj.departmentId) {
      try {
        const Department = (await import('../modules/departments/department.model.js')).default;
        const deptDoc = await Department.findById(userObj.departmentId).populate('managerId', 'name');
        if (deptDoc) {
          if (!userDeptName) userDeptName = deptDoc.name || '';
          if (deptDoc.managerId?.name) {
            userTeamLeadName = deptDoc.managerId.name;
          }
        }
      } catch (e) {}
    }

    const newLeave = new LeaveRequest({
      user: userId,
      employeeId: userObj.employeeId || '',
      userName: userObj.name || '',
      userEmail: userObj.email || '',
      department: userDeptName || 'General',
      reportingManager: userTeamLeadName || userObj.reportingManager || '',
      ccUsers: resolvedCcUsers,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      teamLeadStatus: initialTeamLeadStatus,
      teamLeadActionBy: initialTeamLeadActionBy,
      teamLeadActionAt: initialTeamLeadActionAt,
      teamLeadComment: initialTeamLeadComment,
      hrStatus: 'PENDING',
      finalStatus: 'PENDING',
      isHrRequest: requesterIsHr,
      requiresMdApproval: requesterIsHr
    });

    await newLeave.save();

    // --- TARGETED NOTIFICATION LOGIC ---
    // 1. Target Team Lead (Reporting Manager)
    const teamLeadId = await getTeamLeadUserId(userObj.reportingManager);
    if (teamLeadId && teamLeadId.toString() !== userId.toString()) {
      await sendNotification(
        teamLeadId,
        `📅 New Leave Request from ${userObj.name} (${leaveType}, ${totalDays} day(s)). Pending your review.`,
        'info',
        'Team Leave Request',
        userId,
        userObj.name
      );
    }

    // 2. Target CC Users
    for (const ccUser of resolvedCcUsers) {
      if (ccUser.userId && ccUser.userId.toString() !== userId.toString()) {
        try {
          await sendNotification(
            ccUser.userId,
            `📋 CC Notice: ${userObj.name} (${userObj.department || 'General'}) submitted a Leave Request (${leaveType}, ${totalDays} day(s)).`,
            'info',
            'Leave Request CC Notice',
            userId,
            userObj.name
          );
        } catch (ccNotifErr) {
          console.error("CC notification error:", ccNotifErr);
        }
      }
    }

    // 2. Target HR / Admin Users
    const hrUserIds = await getHrUserIds();
    for (const hrId of hrUserIds) {
      if (hrId.toString() !== userId.toString() && (!teamLeadId || hrId.toString() !== teamLeadId.toString())) {
        await sendNotification(
          hrId,
          `📋 New Leave Request submitted by ${userObj.name} (${userObj.department || 'General'} - ${leaveType}, ${totalDays} day(s)).`,
          'info',
          'Leave Request Alert',
          userId,
          userObj.name
        );
      }
    }

    // 3. Target MD / SuperAdmin if requester is HR
    if (requesterIsHr) {
      const superUserIds = await getSuperAdminUserIds();
      for (const superId of superUserIds) {
        if (superId.toString() !== userId.toString()) {
          await sendNotification(
            superId,
            `👑 HR Leave Request: ${userObj.name} (${userObj.department || 'HR'}) requested leave (${leaveType}, ${totalDays} day(s)). Requires MD Approval (Stage 2).`,
            'info',
            'HR Leave Request - Pending MD Approval',
            userId,
            userObj.name
          );
        }
      }
    }

    // Live Socket Alert for Management
    if (socketService && socketService.emitNewApproval) {
      socketService.emitNewApproval({
        type: 'Leave Request',
        employee: userObj.name,
        department: userObj.department,
        totalDays,
        createdAt: newLeave.createdAt
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully (Stage 1: Pending Team Lead review).',
      data: newLeave
    });

  } catch (error) {
    console.error('Error creating leave request:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while submitting leave request.'
    });
  }
};

/**
 * @desc Get my own leave requests
 * @route GET /api/leaves/my
 * @access Protected
 */
export const getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const leaves = await LeaveRequest.find({ user: userId })
      .populate({
        path: 'user',
        select: 'name email department departmentId reportingManager profile_image avatar',
        populate: {
          path: 'departmentId',
          select: 'name code managerId',
          populate: {
            path: 'managerId',
            select: 'name email designation role'
          }
        }
      })
      .populate('teamLeadActionBy', 'name')
      .populate('hrActionBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: enrichLeaveList(leaves)
    });
  } catch (error) {
    console.error('Error fetching user leave requests:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching your leave requests.'
    });
  }
};

/**
 * @desc Get leave requests for Team Lead's direct reports
 * @route GET /api/leaves/team
 * @access Protected (Team Leads / Managers)
 */
export const getTeamLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const managerName = currentUser.name ? currentUser.name.trim() : '';
    const cleanManagerName = managerName ? managerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    // 1. Collect all department IDs and department names for this Team Lead
    let deptIds = [];
    let deptNames = [];

    if (currentUser.departmentId) {
      deptIds.push(currentUser.departmentId);
    }
    if (currentUser.department && currentUser.department.trim()) {
      deptNames.push(currentUser.department.trim());
    }

    try {
      const Department = (await import('../modules/departments/department.model.js')).default;
      const ledDepts = await Department.find({ managerId: userId }).select('_id name');
      ledDepts.forEach(d => {
        if (d._id) deptIds.push(d._id);
        if (d.name && !deptNames.includes(d.name)) deptNames.push(d.name);
      });
    } catch (e) {}

    // 2. Resolve all employee User IDs under these departments or reporting to this TL
    let deptUserIds = [];
    try {
      const UserDepartment = (await import('../models/userDepartment.model.js')).default;
      if (deptIds.length > 0) {
        const udDocs = await UserDepartment.find({ departmentId: { $in: deptIds } }).select('userId');
        udDocs.forEach(ud => {
          if (ud.userId) deptUserIds.push(ud.userId.toString());
        });
      }

      const userOrConditions = [];
      if (deptIds.length > 0) {
        userOrConditions.push({ departmentId: { $in: deptIds } });
      }
      if (deptNames.length > 0) {
        const regexDeptList = deptNames.map(d => new RegExp(`^${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
        userOrConditions.push({ department: { $in: regexDeptList } });
      }
      if (cleanManagerName) {
        userOrConditions.push({ reportingManager: { $regex: new RegExp(`^${cleanManagerName}$`, 'i') } });
      }

      if (userOrConditions.length > 0) {
        const deptUsers = await User.find({ $or: userOrConditions }).select('_id');
        deptUsers.forEach(u => {
          if (u._id) deptUserIds.push(u._id.toString());
        });
      }
    } catch (e) {
      console.error('Error resolving team user IDs for leave request list:', e);
    }

    const uniqueUserIds = [...new Set(deptUserIds)].filter(id => id && id.toString() !== userId.toString());

    // 3. Query leave requests for department members
    const leaveOrConditions = [];
    if (uniqueUserIds.length > 0) {
      leaveOrConditions.push({ user: { $in: uniqueUserIds } });
    }
    if (cleanManagerName) {
      leaveOrConditions.push({ reportingManager: { $regex: new RegExp(`^${cleanManagerName}$`, 'i') } });
    }
    if (deptNames.length > 0) {
      const regexDeptList = deptNames.map(d => new RegExp(`^${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      leaveOrConditions.push({ department: { $in: regexDeptList } });
    }
    leaveOrConditions.push({ teamLeadActionBy: userId });
    leaveOrConditions.push({ 'ccUsers.userId': userId });

    const query = {
      user: { $ne: userId },
      $or: leaveOrConditions
    };

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'user',
        select: 'name email department departmentId reportingManager profile_image avatar',
        populate: {
          path: 'departmentId',
          select: 'name code managerId',
          populate: {
            path: 'managerId',
            select: 'name email designation role'
          }
        }
      })
      .populate('teamLeadActionBy', 'name')
      .populate('hrActionBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: enrichLeaveList(leaves)
    });
  } catch (error) {
    console.error('Error fetching team leave requests:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching team leave requests.'
    });
  }
};

/**
 * @desc Get all leave requests for HR / Admin / Management
 * @route GET /api/leaves/all
 * @access Protected (HR / Admin / SuperAdmin)
 */
export const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, department, search, stage } = req.query;
    const query = {};

    if (department && department !== 'ALL') {
      const cleanDept = department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.department = { $regex: new RegExp(cleanDept, 'i') };
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { userName: { $regex: cleanSearch, $options: 'i' } },
        { employeeId: { $regex: cleanSearch, $options: 'i' } },
        { reason: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    if (status === 'PENDING' || stage === 'hr_pending') {
      // HR only sees pending requests where TL has APPROVED Stage 1, OR where no reporting manager is assigned
      query.$and = [
        { finalStatus: 'PENDING' },
        {
          $or: [
            { teamLeadStatus: 'APPROVED', hrStatus: 'PENDING' },
            {
              hrStatus: 'PENDING',
              $or: [
                { reportingManager: { $exists: false } },
                { reportingManager: null },
                { reportingManager: '' },
                { reportingManager: { $regex: /^unassigned$/i } }
              ]
            }
          ]
        }
      ];
    } else if (status && status !== 'ALL') {
      query.finalStatus = status;
    }

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'user',
        select: 'name email department departmentId reportingManager profile_image avatar',
        populate: {
          path: 'departmentId',
          select: 'name code managerId',
          populate: {
            path: 'managerId',
            select: 'name email designation role'
          }
        }
      })
      .populate('teamLeadActionBy', 'name')
      .populate('hrActionBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: enrichLeaveList(leaves)
    });
  } catch (error) {
    console.error('Error fetching all leave requests:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching all leave requests.'
    });
  }
};

/**
 * @desc Approve or Reject a Leave Request (Stage 1: Team Lead -> Stage 2: HR)
 * @route PUT /api/leaves/:id/action
 * @access Protected
 */
export const approveOrRejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment, approvalType } = req.body; // action: 'APPROVED' | 'REJECTED', approvalType: 'team_lead' | 'hr'
    const actorId = req.user.id || req.user._id;

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be APPROVED or REJECTED.' });
    }

    const leaveObj = await LeaveRequest.findById(id);
    if (!leaveObj) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    if (leaveObj.finalStatus === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot modify a cancelled leave request.' });
    }

    const actorUser = await User.findById(actorId);
    const userIsHr = isHrOrAdmin(actorUser);
    const userIsSuper = isSuperAdminUser(actorUser);

    let targetType = approvalType;
    if (!targetType) {
      targetType = userIsHr ? 'hr' : 'team_lead';
    }

    const hasReportingManager = leaveObj.reportingManager && 
      leaveObj.reportingManager.trim() !== '' && 
      leaveObj.reportingManager.toLowerCase() !== 'unassigned';

    const requesterUser = await User.findById(leaveObj.user);
    const requesterIsTl = await isTlOrManager(requesterUser);
    const requesterIsHr = leaveObj.isHrRequest || isHrOrAdmin(requesterUser);

    // HR Leave Request Enforcement: HR leave requests ONLY need MD / SuperAdmin approval!
    if (requesterIsHr && !userIsSuper) {
      return res.status(403).json({
        success: false,
        message: 'HR leave requests require MD approval (Stage 2).'
      });
    }

    // STAGE 2 ENFORCEMENT: HR can only approve/reject after Team Lead has APPROVED Stage 1 (unless requester is TL or HR)
    if (targetType === 'hr' && hasReportingManager && leaveObj.teamLeadStatus !== 'APPROVED' && !requesterIsTl && !requesterIsHr) {
      return res.status(400).json({
        success: false,
        message: 'Stage 1 (Team Lead Approval) must be completed before HR can review or take action.'
      });
    }

    if ((requesterIsTl || requesterIsHr) && leaveObj.teamLeadStatus !== 'APPROVED') {
      leaveObj.teamLeadStatus = 'APPROVED';
      leaveObj.teamLeadComment = requesterIsHr ? 'Bypassed (Requester is HR)' : 'Auto-approved (Requester is Team Lead)';
    }

    // Update specific approval fields
    if (targetType === 'team_lead') {
      leaveObj.teamLeadStatus = action;
      leaveObj.teamLeadComment = comment || '';
      leaveObj.teamLeadActionBy = actorId;
      leaveObj.teamLeadActionAt = new Date();
    } else {
      leaveObj.hrStatus = action;
      leaveObj.hrComment = comment || '';
      leaveObj.hrActionBy = actorId;
      leaveObj.hrActionAt = new Date();
    }

    // Evaluate overall finalStatus
    if (leaveObj.teamLeadStatus === 'REJECTED' || leaveObj.hrStatus === 'REJECTED') {
      leaveObj.finalStatus = 'REJECTED';
    } else if (leaveObj.teamLeadStatus === 'APPROVED' && leaveObj.hrStatus === 'APPROVED') {
      leaveObj.finalStatus = 'APPROVED';
    } else {
      leaveObj.finalStatus = 'PENDING';
    }

    await leaveObj.save();

    // --- TARGETED NOTIFICATIONS AFTER ACTION ---
    const requesterId = leaveObj.user;

    // 1. Notify the Employee
    let empMsg = '';
    if (leaveObj.finalStatus === 'APPROVED') {
      empMsg = `🎉 Your leave request (${leaveObj.leaveType}) from ${new Date(leaveObj.startDate).toLocaleDateString()} to ${new Date(leaveObj.endDate).toLocaleDateString()} has been fully APPROVED by both Team Lead and HR!`;
    } else if (leaveObj.finalStatus === 'REJECTED') {
      empMsg = `❌ Your leave request (${leaveObj.leaveType}) was REJECTED by ${targetType === 'hr' ? 'HR' : 'Team Lead'}. Remarks: ${comment || 'No remarks.'}`;
    } else if (targetType === 'team_lead' && action === 'APPROVED') {
      empMsg = `ℹ️ Stage 1 Passed: Your leave request was APPROVED by Team Lead ${actorUser.name}. It has been forwarded to HR for final approval (Stage 2).`;
    } else {
      empMsg = `ℹ️ Your leave request was ${action} by ${targetType === 'hr' ? 'HR' : 'Team Lead'}.`;
    }

    await sendNotification(
      requesterId,
      empMsg,
      leaveObj.finalStatus === 'REJECTED' ? 'warning' : 'info',
      'Leave Request Status Update',
      actorId,
      actorUser.name
    );

    // 2. Workflow Progression Notifications
    if (targetType === 'team_lead' && action === 'APPROVED') {
      // Team Lead approved Stage 1 -> Notify HR to review Stage 2
      const hrUserIds = await getHrUserIds();
      for (const hrId of hrUserIds) {
        if (hrId.toString() !== actorId.toString()) {
          await sendNotification(
            hrId,
            `📢 Stage 1 Approved: Team Lead ${actorUser.name} approved leave request for ${leaveObj.userName} (${leaveObj.leaveType}, ${leaveObj.totalDays} day(s)). Pending your HR review (Stage 2).`,
            'info',
            'Leave Request Pending HR Approval',
            actorId,
            actorUser.name
          );
        }
      }
    } else if (targetType === 'team_lead' && action === 'REJECTED') {
      // Team Lead rejected -> Notify HR of rejection
      const hrUserIds = await getHrUserIds();
      for (const hrId of hrUserIds) {
        if (hrId.toString() !== actorId.toString()) {
          await sendNotification(
            hrId,
            `🚫 Team Lead ${actorUser.name} REJECTED leave request for ${leaveObj.userName}.`,
            'info',
            'Leave Request Rejected by TL',
            actorId,
            actorUser.name
          );
        }
      }
    } else if (targetType === 'hr') {
      // HR action -> Notify Team Lead
      const tlId = await getTeamLeadUserId(leaveObj.reportingManager);
      if (tlId && tlId.toString() !== actorId.toString()) {
        await sendNotification(
          tlId,
          `📢 HR ${actorUser.name} ${action} leave request for ${leaveObj.userName}.`,
          'info',
          'Leave Request HR Activity',
          actorId,
          actorUser.name
        );
      }
    }

    // 3. Notify CC Users
    if (Array.isArray(leaveObj.ccUsers) && leaveObj.ccUsers.length > 0) {
      for (const ccUser of leaveObj.ccUsers) {
        if (ccUser.userId && ccUser.userId.toString() !== actorId.toString()) {
          await sendNotification(
            ccUser.userId,
            `📋 CC Notice: Leave request for ${leaveObj.userName} was ${action} by ${targetType === 'hr' ? 'HR' : 'Team Lead'}. (Overall Status: ${leaveObj.finalStatus})`,
            'info',
            'Leave Request CC Update',
            actorId,
            actorUser.name
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Leave request ${action.toLowerCase()} successfully.`,
      data: leaveObj
    });

  } catch (error) {
    console.error('Error updating leave request:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating leave request.'
    });
  }
};

/**
 * @desc Get Leave History with summary metrics
 * @route GET /api/leaves/history
 * @access Protected
 */
export const getLeaveHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const actorUser = await User.findById(userId);
    const userIsHr = isHrOrAdmin(actorUser);

    const { status, leaveType, search, targetUserId } = req.query;
    const query = {};

    if (!userIsHr) {
      // Regular employees can only view their own leave history
      query.user = userId;
    } else if (targetUserId && targetUserId !== 'ALL') {
      // HR viewing specific employee's history
      query.user = targetUserId;
    }

    if (status && status !== 'ALL') {
      query.finalStatus = status;
    }

    if (leaveType && leaveType !== 'ALL') {
      query.leaveType = leaveType;
    }

    if (search && search.trim()) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'user',
        select: 'name email department departmentId reportingManager profile_image avatar',
        populate: {
          path: 'departmentId',
          select: 'name code managerId',
          populate: {
            path: 'managerId',
            select: 'name email designation role'
          }
        }
      })
      .populate('teamLeadActionBy', 'name')
      .populate('hrActionBy', 'name')
      .sort({ createdAt: -1 });

    // Calculate Summary Metrics
    let totalDaysApproved = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    leaves.forEach(l => {
      if (l.finalStatus === 'APPROVED') {
        approvedCount++;
        totalDaysApproved += (l.totalDays || 0);
      } else if (l.finalStatus === 'REJECTED') {
        rejectedCount++;
      } else if (l.finalStatus === 'CANCELLED') {
        cancelledCount++;
      } else {
        pendingCount++;
      }
    });

    return res.status(200).json({
      success: true,
      metrics: {
        totalDaysApproved,
        approvedCount,
        rejectedCount,
        cancelledCount,
        pendingCount
      },
      data: enrichLeaveList(leaves)
    });
  } catch (error) {
    console.error('Error fetching leave history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching leave history.'
    });
  }
};

/**
 * @desc Cancel a pending Leave Request
 * @route DELETE /api/leaves/:id
 * @access Protected (Owner)
 */
export const cancelLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;
    const currentUser = await User.findById(userId);

    const leaveObj = await LeaveRequest.findById(id);
    if (!leaveObj) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const isOwner = leaveObj.user.toString() === userId.toString();
    const userIsHr = isHrOrAdmin(currentUser);

    if (!isOwner && !userIsHr) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this leave request.' });
    }

    await leaveObj.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting leave request.'
    });
  }
};

/**
 * @desc Edit a Leave Request (SuperAdmin / Admin or Owner)
 * @route PUT /api/leaves/:id
 * @access Protected
 */
export const updateLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { leaveType, startDate, endDate, reason, teamLeadStatus, hrStatus, finalStatus } = req.body;
    const userId = req.user.id || req.user._id;
    const currentUser = await User.findById(userId);

    const isSuper = isSuperAdminUser(currentUser);

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const isOwner = leave.user.toString() === userId.toString();

    if (!isSuper && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this leave request.' });
    }

    if (!isSuper && leave.finalStatus !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Cannot edit a leave request that has already been processed.' });
    }

    if (leaveType) leave.leaveType = leaveType;
    if (startDate) leave.startDate = new Date(startDate);
    if (endDate) leave.endDate = new Date(endDate);
    if (reason) leave.reason = reason;

    if (startDate || endDate) {
      const s = new Date(leave.startDate);
      const e = new Date(leave.endDate);
      if (leave.leaveType === 'Half Day') {
        leave.totalDays = 0.5;
      } else {
        const diffTime = Math.abs(e - s);
        leave.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    if (isSuper) {
      if (teamLeadStatus) leave.teamLeadStatus = teamLeadStatus;
      if (hrStatus) leave.hrStatus = hrStatus;
      if (finalStatus) leave.finalStatus = finalStatus;
    }

    await leave.save();

    return res.status(200).json({
      success: true,
      message: 'Leave request updated successfully.',
      data: leave
    });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating leave request.'
    });
  }
};

