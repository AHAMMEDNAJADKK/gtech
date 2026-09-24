import DailyShiftReport from '../models/dailyShiftReport.model.js';
import User from '../models/user.model.js';
import Attendance from '../models/attendance.model.js';

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

const formatTime = (dateInput) => {
  if (!dateInput) return null;
  try {
    const val = String(dateInput);
    const d = new Date(val.endsWith('Z') ? val : `${val}Z`);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return null;
  }
};

export const getTodayShiftReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { date } = req.query;
    const targetDate = date || getISTDate();

    let report = await DailyShiftReport.findOne({
      userId,
      dateString: targetDate
    });

    const userObj = await User.findById(userId).populate('departmentId', 'name').populate('designationId', 'name');
    const attendanceObj = await Attendance.findOne({ user_id: userId, date: targetDate });

    let inTime = attendanceObj?.check_in_time ? formatTime(attendanceObj.check_in_time) : '09:30 AM';
    let outTime = attendanceObj?.check_out_time ? formatTime(attendanceObj.check_out_time) : '06:30 PM';
    let shiftTiming = `${inTime} - ${outTime}`;

    const defaultBasicDetails = {
      date: targetDate,
      employeeName: userObj?.name || req.user.name || 'Staff Member',
      employeeId: userObj?.employeeId || (userObj?._id ? userObj._id.toString() : 'EMP-001'),
      department: userObj?.department || userObj?.departmentId?.name || 'Operations',
      designation: userObj?.designation || userObj?.designationId?.name || 'Employee',
      reportingTo: userObj?.reportingManager || 'Management',
      shiftTiming,
      workMode: 'Office'
    };

    if (!report) {
      report = {
        userId,
        dateString: targetDate,
        employeeShiftDetails: defaultBasicDetails,
        planVsAchievement: [
          { taskActivity: '', targetToday: '', actualOutput: '', status: 'Completed', businessResultRemarks: '' }
        ],
        departmentKeyMetrics: [
          { metricKpi: '', target: '', actual: '', achievementPct: '', remarks: '' }
        ],
        evidenceAttachments: [
          { workItem: '', crmRecordUrlFileApproval: '' }
        ],
        pendingBlockers: [
          { pendingTaskIssue: '', reasonBlocker: '', owner: '', expectedCompletion: '' }
        ],
        tomorrowPriorities: [
          { priorityText: '' },
          { priorityText: '' },
          { priorityText: '' }
        ],
        handoverFinalConfirmation: {
          handoverRequired: 'No',
          handoverTo: '',
          crmUpdated: 'Yes',
          reportSubmitted: 'Yes',
          employeeComment: ''
        },
        status: 'Draft'
      };
    } else {
      report = report.toObject();
      report.employeeShiftDetails = {
        ...defaultBasicDetails,
        ...report.employeeShiftDetails
      };
    }

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching today shift report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getShiftReportByDate = async (req, res) => {
  try {
    const { userId, dateString } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;
    const targetDate = dateString || getISTDate();

    let report = await DailyShiftReport.findOne({
      userId: targetUserId,
      dateString: targetDate
    });

    const userObj = await User.findById(targetUserId).populate('departmentId', 'name').populate('designationId', 'name');
    const attendanceObj = await Attendance.findOne({ user_id: targetUserId, date: targetDate });

    let inTime = attendanceObj?.check_in_time ? formatTime(attendanceObj.check_in_time) : '09:30 AM';
    let outTime = attendanceObj?.check_out_time ? formatTime(attendanceObj.check_out_time) : '06:30 PM';
    let shiftTiming = `${inTime} - ${outTime}`;

    const defaultBasicDetails = {
      date: targetDate,
      employeeName: userObj?.name || 'Staff Member',
      employeeId: userObj?.employeeId || (userObj?._id ? userObj._id.toString() : 'EMP-001'),
      department: userObj?.department || userObj?.departmentId?.name || 'Operations',
      designation: userObj?.designation || userObj?.designationId?.name || 'Employee',
      reportingTo: userObj?.reportingManager || 'Management',
      shiftTiming,
      workMode: 'Office'
    };

    if (!report) {
      return res.status(200).json({
        success: true,
        data: null,
        defaultBasicDetails
      });
    }

    report = report.toObject();
    report.employeeShiftDetails = {
      ...defaultBasicDetails,
      ...report.employeeShiftDetails
    };

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching shift report by date:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getStaffList = async (req, res) => {
  try {
    const users = await User.find({ is_deleted: { $ne: true } })
      .select('name email employeeId role department designation reportingManager')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching staff list:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSubmittedDates = async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;

    const reports = await DailyShiftReport.find({ userId: targetUserId }).select('dateString');
    const dates = reports.map(r => r.dateString).filter(Boolean);

    return res.status(200).json({
      success: true,
      data: dates
    });
  } catch (error) {
    console.error('Error fetching submitted dates:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const saveShiftReport = async (req, res) => {
  try {
    const activeUserId = req.user.id || req.user._id;
    const {
      userId,
      dateString,
      employeeShiftDetails,
      planVsAchievement,
      departmentKeyMetrics,
      evidenceAttachments,
      pendingBlockers,
      tomorrowPriorities,
      handoverFinalConfirmation,
      status
    } = req.body;

    const targetUserId = userId || activeUserId;
    const targetDate = dateString || getISTDate();

    const report = await DailyShiftReport.findOneAndUpdate(
      { userId: targetUserId, dateString: targetDate },
      {
        $set: {
          userId: targetUserId,
          dateString: targetDate,
          employeeShiftDetails,
          planVsAchievement,
          departmentKeyMetrics,
          evidenceAttachments,
          pendingBlockers,
          tomorrowPriorities,
          handoverFinalConfirmation,
          status: status || 'Submitted'
        }
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Daily Shift Report saved successfully!',
      data: report
    });
  } catch (error) {
    console.error('Error saving shift report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyShiftReports = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reports = await DailyShiftReport.find({ userId })
      .sort({ dateString: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching my shift reports:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllShiftReports = async (req, res) => {
  try {
    const { date } = req.query;
    const query = date ? { dateString: date } : {};

    const reports = await DailyShiftReport.find(query)
      .populate('userId', 'name email role department designation avatar')
      .sort({ dateString: -1, updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching all shift reports:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
