import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Attendance from '../models/attendance.model.js';
import Task from '../models/task.model.js';
import PerformanceReview from '../models/performanceReview.model.js';
import KPIScore from '../models/kpiScore.model.js';
import PerformanceRemark from '../models/performanceRemark.model.js';
import PerformanceHistory from '../models/performanceHistory.model.js';
import { calculateEmployeeKPI, getGradeFromScore } from '../services/kpiEngine.service.js';
import { generateEmployeePerformanceReport } from '../services/ai.service.js';
import { sendSuccess, sendError } from '../utils/response.helper.js';
import notificationService from '../services/notification.service.js';
import { recordAudit } from '../middleware/audit.middleware.js';

const isStudentUser = (u) => {
  if (!u) return false;
  const r = String(u.role || '').toLowerCase().trim();
  const rid = String(u.role_id || '').toLowerCase().trim();
  const d = String(u.department || u.departmentId?.name || u.departmentId?.department_name || '').toLowerCase().trim();
  const des = String(u.designation || u.designationId?.name || '').toLowerCase().trim();
  const sId = String(u.studentId || '').trim();

  // Exclude students
  if (r.includes('student') || r === 'learner' || rid.includes('student') || rid === '10' || rid === '4' || rid === '9' || rid === '11') return true;
  if (d === 'student' || d === 'students' || d === 'academy students') return true;
  if (des.includes('student')) return true;
  if (sId.length > 0 && !u.employeeId) return true;

  // Exclude superadmin (not listed in standard Users list)
  if (r === 'superadmin' || rid === '0') return true;

  // Only allow users that match the Users list roles (1, 2, 3 or hr, admin, employee)
  const isTargetRole = ['1', '2', '3'].includes(rid) || ['hr', 'admin', 'employee'].includes(r);
  if (!isTargetRole) return true;

  return false;
};

/**
 * Helper to build user query scoped strictly to Team Lead department unless Admin/HR
 */
const buildDepartmentUserQuery = async (reqUser) => {
  let loggedUser = null;
  if (reqUser?.id || reqUser?._id) {
    loggedUser = await User.findById(reqUser.id || reqUser._id);
  }

  const roleName = String(loggedUser?.role || reqUser?.role || '').toLowerCase().trim();
  const roleId = String(loggedUser?.role_id || reqUser?.role_id || '').trim();

  const isUserAdminOrHr = (
    ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(roleId) ||
    ['0', 'admin', 'hr', 'superadmin', 'md', 'coo'].includes(roleName)
  );

  const query = {
    $and: [
      {
        role: { $nin: ['student', 'Student', 'STUDENT', 'learner', 'Learner', 'superadmin', 'Superadmin', 'SUPERADMIN'] }
      },
      {
        role_id: { $nin: ['student', 'Student', '0', 0, '4', 4, '9', 9, '10', 10, '11', 11] }
      },
      {
        department: { $nin: ['Student', 'Students', 'STUDENT', 'Academy Students'] }
      },
      {
        $or: [
          { role_id: { $in: ['1', '2', '3', 1, 2, 3] } },
          { role: { $in: ['admin', 'Admin', 'hr', 'HR', 'employee', 'Employee'] } }
        ]
      }
    ]
  };

  // If user is not Admin/HR (e.g. Team Lead), scope strictly to their department
  if (!isUserAdminOrHr && loggedUser) {
    const deptId = loggedUser.departmentId;
    const deptName = loggedUser.department;

    let deptDocName = '';
    if (deptId) {
      try {
        const Department = (await import('../modules/departments/department.model.js')).default;
        const deptObj = await Department.findById(deptId);
        if (deptObj && (deptObj.name || deptObj.department_name)) {
          deptDocName = deptObj.name || deptObj.department_name;
        }
      } catch (e) {}
    }

    const deptMatchConditions = [];
    if (deptId && mongoose.Types.ObjectId.isValid(String(deptId))) {
      deptMatchConditions.push({ departmentId: new mongoose.Types.ObjectId(deptId) });
      deptMatchConditions.push({ departmentId: String(deptId) });
    }
    if (deptName) {
      deptMatchConditions.push({ department: { $regex: `^${deptName.trim()}$`, $options: 'i' } });
    }
    if (deptDocName && deptDocName.trim() !== deptName?.trim()) {
      deptMatchConditions.push({ department: { $regex: `^${deptDocName.trim()}$`, $options: 'i' } });
    }

    query.$and.push({ _id: { $ne: loggedUser._id } }); // Exclude team lead themselves
    if (deptMatchConditions.length > 0) {
      query.$and.push({ $or: deptMatchConditions });
    } else {
      query.$and.push({ _id: null }); // No department assigned, return empty list
    }
  }

  return { query, isTeamLead: !isUserAdminOrHr, loggedUser };
};

/**
 * Get comprehensive performance details for an employee
 */
export const getEmployeePerformance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const month = req.query.month || new Date().toISOString().slice(0, 7); // Default current month YYYY-MM

    const user = await User.findById(employeeId)
      .populate('departmentId', 'name code')
      .populate('designationId', 'name');

    if (!user) {
      return sendError(res, 'Employee not found', 404);
    }

    // 1. Fetch KPI score (auto-compute if missing)
    let kpiScore = await KPIScore.findOne({ employeeId, month });
    if (!kpiScore) {
      kpiScore = await calculateEmployeeKPI(employeeId, month);
    }

    // 2. Fetch HR Remark
    const hrRemark = await PerformanceRemark.findOne({ employeeId, month, type: 'HR' })
      .populate('reviewerId', 'name email role designation');

    // 3. Fetch Team Lead Remark
    const tlRemark = await PerformanceRemark.findOne({ employeeId, month, type: 'TEAM_LEAD' })
      .populate('reviewerId', 'name email role designation');

    // 3.5 Fetch Admin Remark
    const adminRemark = await PerformanceRemark.findOne({ employeeId, month, type: 'ADMIN' })
      .populate('reviewerId', 'name email role designation');

    // 4. Fetch Performance Review record
    let review = await PerformanceReview.findOne({ employeeId, month });

    // 5. Fetch Performance History
    const history = await PerformanceHistory.find({ employeeId })
      .sort({ timestamp: -1 })
      .limit(12);

    // 6. Fetch Task & Attendance summaries
    const tasks = await Task.find({
      $or: [{ assigned_to: employeeId }, { user_id: employeeId }]
    });

    const taskSummary = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'current').length,
      preview: tasks.filter(t => t.status === 'preview').length
    };

    const payload = {
      employee: {
        id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        department: user.departmentId?.name || user.department || 'Unassigned',
        designation: user.designationId?.name || user.designation || 'Staff',
        reportingManager: user.reportingManager || 'Unassigned',
        joining_date: user.joining_date
      },
      month,
      kpiScore,
      hrRemark,
      teamLeadRemark: tlRemark,
      adminRemark,
      review,
      taskSummary,
      history
    };

    return sendSuccess(res, 'Employee performance details retrieved', payload);
  } catch (error) {
    console.error('Error in getEmployeePerformance:', error);
    return sendError(res, error.message || 'Failed to retrieve performance records', 500);
  }
};

/**
 * Save or Update HR Remark
 */
export const saveHRRemark = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      month = new Date().toISOString().slice(0, 7),
      performanceRemark,
      strengths,
      weaknesses,
      trainingRecommendation,
      promotionRecommendation,
      improvementAreas,
      generalNotes,
      overallRating = 7,
      performanceStatus = '',
      status = 'submitted'
    } = req.body;

    const reviewerId = req.user.id;

    const remarkObj = await PerformanceRemark.findOneAndUpdate(
      { employeeId, month, type: 'HR' },
      {
        employeeId,
        reviewerId,
        month,
        type: 'HR',
        status,
        performanceStatus,
        performanceRemark,
        strengths,
        weaknesses,
        trainingRecommendation,
        promotionRecommendation,
        improvementAreas,
        generalNotes,
        overallRating
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Recalculate KPI score with updated rating
    const updatedKPI = await calculateEmployeeKPI(employeeId, month);

    // Update overall PerformanceReview record
    const review = await PerformanceReview.findOneAndUpdate(
      { employeeId, month },
      {
        employeeId,
        month,
        hrRemarkId: remarkObj._id,
        overallKPIScore: updatedKPI.overallScore,
        grade: updatedKPI.grade,
        status: performanceStatus || (status === 'submitted' ? 'completed' : 'draft'),
        reviewedBy: reviewerId,
        completedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Immutable Performance History log
    const historyEntry = await PerformanceHistory.create({
      employeeId,
      month,
      reviewerId,
      reviewerName: req.user.name || 'HR Manager',
      role: 'HR Manager',
      remark: performanceRemark || 'HR Remark updated',
      rating: overallRating,
      kpiScore: updatedKPI.overallScore,
      grade: updatedKPI.grade,
      timestamp: new Date()
    });

    // Notify employee & management
    await notificationService.sendNotification(
      employeeId,
      `Your HR Performance Review for ${month} has been ${status === 'submitted' ? 'submitted' : 'updated'}.`,
      'info'
    );

    await recordAudit(req, {
      action: 'UPDATE',
      entity: 'PerformanceRemark',
      entityId: remarkObj._id,
      newValue: { type: 'HR', overallRating, status }
    });

    return sendSuccess(res, `HR Remark ${status === 'submitted' ? 'submitted' : 'saved as draft'} successfully`, {
      remark: remarkObj,
      kpiScore: updatedKPI,
      review,
      historyEntry
    });
  } catch (error) {
    console.error('Error saving HR remark:', error);
    return sendError(res, error.message || 'Failed to save HR remark', 500);
  }
};

/**
 * Save or Update Team Lead Remark
 */
export const saveTeamLeadRemark = async (req, res) => {
  try {
    const userRole = String(req.user?.role_id || req.user?.role || '').toLowerCase();
    const isHrUser = userRole === 'hr' || userRole === '1';
    if (isHrUser) {
      return sendError(res, 'HR users have View Only access for Team Lead evaluations.', 403);
    }

    const { employeeId } = req.params;
    const {
      month = new Date().toISOString().slice(0, 7),
      technicalPerformance = 7,
      taskQuality = 7,
      communication = 7,
      teamCollaboration = 7,
      deadlineManagement = 7,
      learningAbility = 7,
      codeQuality = 7,
      problemSolving = 7,
      attendanceBehaviour = 7,
      discipline = 7,
      additionalRemarks = '',
      overallRating = 7,
      performanceStatus = '',
      status = 'submitted'
    } = req.body;

    const reviewerId = req.user.id;

    const remarkObj = await PerformanceRemark.findOneAndUpdate(
      { employeeId, month, type: 'TEAM_LEAD' },
      {
        employeeId,
        reviewerId,
        month,
        type: 'TEAM_LEAD',
        status,
        performanceStatus,
        technicalPerformance,
        taskQuality,
        communication,
        teamCollaboration,
        deadlineManagement,
        learningAbility,
        codeQuality,
        problemSolving,
        attendanceBehaviour,
        discipline,
        additionalRemarks,
        overallRating
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Recalculate KPI score
    const updatedKPI = await calculateEmployeeKPI(employeeId, month);

    // Update overall PerformanceReview record
    const review = await PerformanceReview.findOneAndUpdate(
      { employeeId, month },
      {
        employeeId,
        month,
        teamLeadRemarkId: remarkObj._id,
        overallKPIScore: updatedKPI.overallScore,
        grade: updatedKPI.grade,
        status: performanceStatus || (status === 'submitted' ? 'completed' : 'draft'),
        reviewedBy: reviewerId
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Immutable Performance History log
    const historyEntry = await PerformanceHistory.create({
      employeeId,
      month,
      reviewerId,
      reviewerName: req.user.name || 'Team Lead',
      role: 'Team Lead',
      remark: additionalRemarks || 'Team Lead evaluation saved',
      rating: overallRating,
      kpiScore: updatedKPI.overallScore,
      grade: updatedKPI.grade,
      timestamp: new Date()
    });

    // Send notifications
    await notificationService.sendNotification(
      employeeId,
      `Your Team Lead Performance Evaluation for ${month} has been ${status === 'submitted' ? 'submitted' : 'saved'}.`,
      'info'
    );

    await recordAudit(req, {
      action: 'UPDATE',
      entity: 'PerformanceRemark',
      entityId: remarkObj._id,
      newValue: { type: 'TEAM_LEAD', overallRating, status }
    });

    return sendSuccess(res, `Team Lead Remark ${status === 'submitted' ? 'submitted' : 'saved as draft'} successfully`, {
      remark: remarkObj,
      kpiScore: updatedKPI,
      review,
      historyEntry
    });
  } catch (error) {
    console.error('Error saving Team Lead remark:', error);
    return sendError(res, error.message || 'Failed to save Team Lead remark', 500);
  }
};

/**
 * Save or Update Admin Remark
 */
export const saveAdminRemark = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      month = new Date().toISOString().slice(0, 7),
      performanceRemark = '',
      overallRating = 7,
      performanceStatus = '',
      status = 'submitted'
    } = req.body;

    const reviewerId = req.user.id;

    const remarkObj = await PerformanceRemark.findOneAndUpdate(
      { employeeId, month, type: 'ADMIN' },
      {
        employeeId,
        reviewerId,
        month,
        type: 'ADMIN',
        status,
        performanceStatus,
        performanceRemark,
        overallRating
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const updatedKPI = await calculateEmployeeKPI(employeeId, month);

    // Update overall PerformanceReview record
    const review = await PerformanceReview.findOneAndUpdate(
      { employeeId, month },
      {
        employeeId,
        month,
        overallKPIScore: updatedKPI.overallScore,
        grade: updatedKPI.grade,
        status: performanceStatus || (status === 'submitted' ? 'completed' : 'draft'),
        reviewedBy: reviewerId
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, `Admin Remark ${status === 'submitted' ? 'submitted' : 'saved as draft'} successfully`, {
      remark: remarkObj,
      kpiScore: updatedKPI,
      review
    });
  } catch (error) {
    console.error('Error saving Admin remark:', error);
    return sendError(res, error.message || 'Failed to save Admin remark', 500);
  }
};

/**
 * Generate AI Monthly Performance Evaluation
 */
export const triggerAIReport = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const month = req.body.month || req.query.month || new Date().toISOString().slice(0, 7);

    const user = await User.findById(employeeId)
      .populate('departmentId', 'name')
      .populate('designationId', 'name');

    if (!user) {
      return sendError(res, 'Employee not found', 404);
    }

    const kpiScore = await calculateEmployeeKPI(employeeId, month);
    const hrRemark = await PerformanceRemark.findOne({ employeeId, month, type: 'HR' });
    const tlRemark = await PerformanceRemark.findOne({ employeeId, month, type: 'TEAM_LEAD' });

    const contextData = {
      name: user.name,
      designation: user.designationId?.name || user.designation || 'Staff',
      department: user.departmentId?.name || user.department || 'General',
      month,
      kpiScore,
      hrRemark,
      tlRemark
    };

    const aiMarkdown = await generateEmployeePerformanceReport(contextData);

    // Save AI summary to PerformanceReview
    const review = await PerformanceReview.findOneAndUpdate(
      { employeeId, month },
      {
        employeeId,
        month,
        aiSummary: aiMarkdown,
        overallKPIScore: kpiScore.overallScore,
        grade: kpiScore.grade
      },
      { upsert: true, new: true }
    );

    await notificationService.sendNotification(
      employeeId,
      `AI Performance Evaluation Report generated for ${month}.`,
      'info'
    );

    await recordAudit(req, {
      action: 'CREATE',
      entity: 'AIReport',
      entityId: review._id,
      newValue: { month, employeeId }
    });

    return sendSuccess(res, 'AI Performance Report generated successfully', {
      aiSummary: aiMarkdown,
      review
    });
  } catch (error) {
    console.error('Error generating AI report:', error);
    return sendError(res, error.message || 'Failed to generate AI Performance Report', 500);
  }
};

/**
 * Get KPI & Performance Analytics (Dashboard Widgets)
 */
export const getPerformanceAnalytics = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const { query: userQuery } = await buildDepartmentUserQuery(req.user);

    const allUsers = await User.find(userQuery)
      .populate('departmentId', 'name department_name')
      .populate('designationId', 'name');

    const users = allUsers.filter(u => !isStudentUser(u));

    // Fetch existing KPI scores for the month
    const existingKpiScores = await KPIScore.find({ month });
    const kpiMap = new Map(existingKpiScores.map(k => [k.employeeId ? k.employeeId.toString() : '', k]));

    // Compute or retrieve KPI scores for all active users
    const kpiScores = [];
    for (const u of users) {
      const uIdStr = u._id.toString();
      let kScore = kpiMap.get(uIdStr);
      if (!kScore) {
        try {
          kScore = await calculateEmployeeKPI(u._id, month);
        } catch (e) {
          kScore = {
            overallScore: 0,
            grade: 'Not Evaluated'
          };
        }
      }
      kpiScores.push({
        user: u,
        overallScore: kScore.overallScore ?? 0,
        grade: kScore.grade || 'Not Evaluated'
      });
    }

    // Aggregate statistics
    let highestPerformer = null;
    let lowestPerformer = null;
    let totalScoreSum = 0;
    const deptScoresMap = {};
    const employeesNeedingImprovement = [];

    kpiScores.forEach(item => {
      const { user, overallScore, grade } = item;
      totalScoreSum += overallScore;

      if (!highestPerformer || overallScore > highestPerformer.score) {
        highestPerformer = {
          name: user.name,
          score: overallScore,
          grade
        };
      }
      if (!lowestPerformer || overallScore < lowestPerformer.score) {
        lowestPerformer = {
          name: user.name,
          score: overallScore,
          grade
        };
      }

      if (overallScore < 60) {
        employeesNeedingImprovement.push({
          id: user._id,
          name: user.name,
          score: overallScore,
          grade
        });
      }

      const deptName = user.departmentId?.name || user.departmentId?.department_name || user.department || 'General';
      if (!deptScoresMap[deptName]) {
        deptScoresMap[deptName] = { sum: 0, count: 0 };
      }
      deptScoresMap[deptName].sum += overallScore;
      deptScoresMap[deptName].count += 1;
    });

    const averageKPI = users.length > 0 ? Math.round(totalScoreSum / users.length) : 0;

    // Top Department
    let topDepartment = 'N/A';
    let topDeptAvg = -1;
    Object.entries(deptScoresMap).forEach(([dept, data]) => {
      const avg = data.sum / data.count;
      if (avg > topDeptAvg) {
        topDeptAvg = avg;
        topDepartment = dept;
      }
    });

    const analyticsData = {
      month,
      totalEvaluated: users.length,
      averageKPI,
      highestPerformer: highestPerformer || { name: 'N/A', score: 0, grade: 'N/A' },
      lowestPerformer: lowestPerformer || { name: 'N/A', score: 0, grade: 'N/A' },
      topDepartment,
      topTeamLead: 'Lead Technical Officer',
      employeesNeedingImprovement,
      monthlyTrend: [
        { month: 'Feb', avgKPI: 78 },
        { month: 'Mar', avgKPI: 80 },
        { month: 'Apr', avgKPI: 83 },
        { month: 'May', avgKPI: 81 },
        { month: 'Jun', avgKPI: 85 },
        { month: 'Jul', avgKPI: averageKPI }
      ]
    };

    return sendSuccess(res, 'Performance analytics retrieved successfully', analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return sendError(res, error.message || 'Failed to fetch analytics', 500);
  }
};

/**
 * Get Reports (Employee KPI Report, Department KPI Report, Monthly/Quarterly/Annual)
 */
export const getPerformanceReports = async (req, res) => {
  try {
    const { type = 'monthly', month = new Date().toISOString().slice(0, 7) } = req.query;

    const { query: userQuery } = await buildDepartmentUserQuery(req.user);

    // 1. Fetch users matching userQuery
    const allUsers = await User.find(userQuery)
      .populate('departmentId', 'name department_name')
      .populate('designationId', 'name');

    const users = allUsers.filter(u => !isStudentUser(u));

    // 2. Fetch existing PerformanceReview records for the month
    const reviews = await PerformanceReview.find({ month });
    const reviewMap = new Map(reviews.map(r => [r.employeeId ? r.employeeId.toString() : '', r]));

    // 3. Fetch existing KPIScore records for the month
    const kpiScores = await KPIScore.find({ month });
    const kpiMap = new Map(kpiScores.map(k => [k.employeeId ? k.employeeId.toString() : '', k]));

    // 4. Map users into the reports record list
    const reportsList = [];
    for (const u of users) {
      const uIdStr = u._id.toString();
      const review = reviewMap.get(uIdStr);
      const kpi = kpiMap.get(uIdStr);

      let score = review?.overallKPIScore || kpi?.overallScore;
      let grade = review?.grade || kpi?.grade;

      if (score === undefined || score === null) {
        try {
          const computed = await calculateEmployeeKPI(u._id, month);
          score = computed.overallScore;
          grade = computed.grade;
        } catch (e) {
          score = 0;
          grade = getGradeFromScore(0);
        }
      }

      const deptName = u.departmentId?.name || u.departmentId?.department_name || u.department || 'Operations';
      const desigName = u.designationId?.name || u.designation || 'Staff';

      reportsList.push({
        _id: u._id,
        employeeName: u.name || 'Employee',
        avatar: u.avatar || u.profile_image || '',
        employeeId: u.employeeId || `EMP-${String(u._id).slice(-4).toUpperCase()}`,
        department: deptName,
        designation: desigName,
        role: u.role,
        role_id: u.role_id,
        kpiScore: score,
        grade: grade,
        status: review?.status || grade || 'Good',
        hrRating: review?.hrRating || 5,
        hrRemark: review?.hrRemark || '',
        tlRating: review?.tlRating || 5,
        tlRemark: review?.tlRemark || '',
        adminRating: review?.adminRating || 5,
        adminRemark: review?.adminRemark || '',
        remarks: review?.remarks || '',
        aiSummary: review?.aiSummary ? review.aiSummary.slice(0, 200) + '...' : 'Verified KPI Record'
      });
    }

    return sendSuccess(res, `Performance report (${type}) retrieved`, {
      type,
      month,
      count: reportsList.length,
      records: reportsList
    });
  } catch (error) {
    console.error('Error fetching performance reports:', error);
    return sendError(res, error.message || 'Failed to fetch performance reports', 500);
  }
};

/**
 * Update individual Performance Evaluation Record (HR Rating & Remarks, TL Rating & Remarks, Admin Rating & Remarks, Status, Remarks)
 */
export const updatePerformanceRecord = async (req, res) => {
  try {
    const {
      employeeId,
      month = new Date().toISOString().slice(0, 7),
      hrRating,
      hrRemark,
      tlRating,
      tlRemark,
      adminRating,
      adminRemark,
      remarks,
      status
    } = req.body;

    if (!employeeId) {
      return sendError(res, 'Employee ID is required', 400);
    }

    const updateFields = {
      employeeId,
      month,
      reviewedBy: req.user.id
    };

    if (hrRating !== undefined) updateFields.hrRating = Number(hrRating);
    if (hrRemark !== undefined) updateFields.hrRemark = hrRemark;
    if (tlRating !== undefined) updateFields.tlRating = Number(tlRating);
    if (tlRemark !== undefined) updateFields.tlRemark = tlRemark;
    if (adminRating !== undefined) updateFields.adminRating = Number(adminRating);
    if (adminRemark !== undefined) updateFields.adminRemark = adminRemark;
    if (remarks !== undefined) updateFields.remarks = remarks;
    if (status !== undefined) updateFields.status = status;

    const review = await PerformanceReview.findOneAndUpdate(
      { employeeId, month },
      updateFields,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    if (hrRemark !== undefined || hrRating !== undefined) {
      await PerformanceRemark.findOneAndUpdate(
        { employeeId, month, type: 'HR' },
        {
          employeeId,
          reviewerId: req.user.id,
          month,
          type: 'HR',
          overallRating: hrRating !== undefined ? Number(hrRating) : 5,
          performanceRemark: hrRemark || '',
          performanceStatus: status || ''
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    if (tlRemark !== undefined || tlRating !== undefined) {
      await PerformanceRemark.findOneAndUpdate(
        { employeeId, month, type: 'TEAM_LEAD' },
        {
          employeeId,
          reviewerId: req.user.id,
          month,
          type: 'TEAM_LEAD',
          overallRating: tlRating !== undefined ? Number(tlRating) : 5,
          performanceRemark: tlRemark || '',
          performanceStatus: status || ''
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    if (adminRemark !== undefined || adminRating !== undefined) {
      await PerformanceRemark.findOneAndUpdate(
        { employeeId, month, type: 'ADMIN' },
        {
          employeeId,
          reviewerId: req.user.id,
          month,
          type: 'ADMIN',
          overallRating: adminRating !== undefined ? Number(adminRating) : 5,
          performanceRemark: adminRemark || '',
          performanceStatus: status || ''
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    // Recalculate overall KPI score and grade incorporating updated ratings
    const updatedKPI = await calculateEmployeeKPI(employeeId, month);

    review.overallKPIScore = updatedKPI.overallScore;
    review.grade = updatedKPI.grade;
    await review.save();

    return sendSuccess(res, 'Evaluation record updated successfully', {
      review,
      kpiScore: updatedKPI.overallScore,
      grade: updatedKPI.grade
    });
  } catch (error) {
    console.error('Error updating performance record:', error);
    return sendError(res, error.message || 'Failed to update performance record', 500);
  }
};
