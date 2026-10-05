import MonthlyPerformanceReport from '../models/monthlyPerformanceReport.model.js';
import DailyShiftReport from '../models/dailyShiftReport.model.js';
import User from '../models/user.model.js';

const getISTDate = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(d);
};

export const getMonthlyReport = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;

    // Default to current month start and end if not provided
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatIST = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

    let start = startDate || formatIST(firstDay);
    let end = endDate || formatIST(lastDay);

    let report = await MonthlyPerformanceReport.findOne({
      userId: targetUserId,
      monthStartDate: start,
      monthEndDate: end
    });

    const userObj = await User.findById(targetUserId).populate('departmentId', 'name').populate('designationId', 'name');

    const monthName = new Date(start).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const defaultBasicDetails = {
      monthYear: monthName || `${start} to ${end}`,
      employeeName: userObj?.name || '',
      designation: userObj?.designationName || userObj?.designation || userObj?.designationId?.name || '',
      employeeId: userObj?.employeeId || '',
      department: userObj?.departmentName || userObj?.department || userObj?.departmentId?.name || '',
      hodTeamLead: userObj?.reportingManager || userObj?.name || '',
      totalTeamMembers: '1'
    };

    if (!report) {
      return res.status(200).json({
        success: true,
        data: null,
        defaultBasicDetails
      });
    }

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching monthly performance report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const autoCompileMonthlyReport = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatIST = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

    let start = startDate || formatIST(firstDay);
    let end = endDate || formatIST(lastDay);

    const userObj = await User.findById(targetUserId).populate('departmentId', 'name').populate('designationId', 'name');
    const shiftReports = await DailyShiftReport.find({
      userId: targetUserId,
      dateString: { $gte: start, $lte: end }
    }).sort({ dateString: 1 });

    const projectCampaignMap = new Map();
    const kpiMap = new Map();
    const achievementsList = [];
    const nextMonthPlanList = [];
    const studentLeadsMap = new Map();
    const clientLeadsMap = new Map();

    shiftReports.forEach(r => {
      // 1. Project / Campaign Status
      let currentProjectName = '';
      (r.planVsAchievement || []).forEach(t => {
        const rawProj = (t.taskActivity || '').trim();
        if (rawProj !== '') {
          currentProjectName = rawProj;
        }

        const actualText = (t.actualOutput || '').trim();
        const remarksText = (t.businessResultRemarks || '').trim();

        if (currentProjectName || actualText) {
          const projName = currentProjectName || 'General Projects';
          if (!projectCampaignMap.has(projName)) {
            projectCampaignMap.set(projName, {
              projectCampaign: projName,
              planned: t.targetToday || '100%',
              actualPct: actualText || '100%',
              status: t.status || 'Completed',
              clientOwner: userObj?.name || '',
              remarks: remarksText
            });
          }
        }
      });

      // 2. Overall KPI Summary
      (r.departmentKeyMetrics || []).forEach(m => {
        if ((m.metricKpi || '').trim()) {
          const key = m.metricKpi.trim();
          if (!kpiMap.has(key)) {
            kpiMap.set(key, {
              kpi: key,
              monthlyTarget: m.target || '',
              actual: m.actual || '',
              achievementPct: m.achievementPct || '',
              statusTrend: 'On Track'
            });
          }
        }
      });

      // 3. Key Achievements & Business Impact
      (r.evidenceAttachments || []).forEach(e => {
        if ((e.workItem || '').trim()) {
          achievementsList.push({
            achievement: e.workItem,
            evidenceImpact: e.crmRecordUrlFileApproval || ''
          });
        }
      });

      // 4. Next Month Plan
      (r.tomorrowPriorities || []).forEach(p => {
        if ((p.priorityTask || '').trim()) {
          nextMonthPlanList.push({
            priorityObjective: p.priorityLevel || 'High',
            owner: userObj?.name || '',
            targetResult: p.priorityTask,
            deadline: p.targetTime || getISTDate(30)
          });
        }
      });

      // 5. Academic Counselor & Telecaller Lead Aggregations
      (r.studentLeadsUpdate || []).forEach(sl => {
        const act = (sl.activity || '').trim();
        if (act) {
          const val = parseFloat(sl.count) || 0;
          if (!studentLeadsMap.has(act)) {
            studentLeadsMap.set(act, { monthlyTotal: val, remarks: sl.remarks || '' });
          } else {
            const prev = studentLeadsMap.get(act);
            prev.monthlyTotal += val;
            if (sl.remarks && !prev.remarks) prev.remarks = sl.remarks;
          }
        }
      });

      (r.clientLeadsUpdate || []).forEach(cl => {
        const act = (cl.activity || '').trim();
        if (act) {
          const val = parseFloat(cl.count) || 0;
          if (!clientLeadsMap.has(act)) {
            clientLeadsMap.set(act, { monthlyTotal: val, remarks: cl.remarks || '' });
          } else {
            const prev = clientLeadsMap.get(act);
            prev.monthlyTotal += val;
            if (cl.remarks && !prev.remarks) prev.remarks = cl.remarks;
          }
        }
      });
    });

    const projectCampaignStatus = Array.from(projectCampaignMap.values());
    const overallKpiSummary = Array.from(kpiMap.values());

    const studentLeadsSummary = Array.from(studentLeadsMap.entries()).map(([activity, data]) => ({
      activity,
      monthlyTotal: String(data.monthlyTotal),
      remarks: data.remarks
    }));

    const clientLeadsSummary = Array.from(clientLeadsMap.entries()).map(([activity, data]) => ({
      activity,
      monthlyTotal: String(data.monthlyTotal),
      remarks: data.remarks
    }));

    // Default Financial Summary Particulars
    const financialSummary = [
      { particulars: 'Revenue Billed', amountCount: '', remarks: '' },
      { particulars: 'Revenue Received', amountCount: '', remarks: '' },
      { particulars: 'Expenses / Ad Spend', amountCount: '', remarks: '' },
      { particulars: 'Receivables / Pending', amountCount: '', remarks: '' },
      { particulars: 'Profit / Contribution', amountCount: '', remarks: '' }
    ];

    // Default Team / HR Operational Metrics
    const teamHrOperationalSummary = [
      { metric: 'Headcount / Active Staff', countResult: '', remarks: '' },
      { metric: 'Attendance / Productivity', countResult: '', remarks: '' },
      { metric: 'Leaves / WFH', countResult: '', remarks: '' },
      { metric: 'New Joiners / Exits', countResult: '', remarks: '' },
      { metric: 'Major Operational Issues', countResult: '', remarks: '' }
    ];

    const monthName = new Date(start).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const compiledData = {
      basicDetails: {
        monthYear: monthName || `${start} to ${end}`,
        employeeName: userObj?.name || '',
        designation: userObj?.designationName || userObj?.designation || userObj?.designationId?.name || '',
        employeeId: userObj?.employeeId || '',
        department: userObj?.departmentName || userObj?.department || userObj?.departmentId?.name || '',
        hodTeamLead: userObj?.reportingManager || userObj?.name || '',
        totalTeamMembers: '1'
      },
      overallKpiSummary,
      keyAchievements: achievementsList.slice(0, 10),
      projectCampaignStatus,
      financialSummary,
      teamHrOperationalSummary,
      nextMonthPlan: nextMonthPlanList.slice(0, 10),
      studentLeadsSummary,
      clientLeadsSummary,
      hodSubmission: {
        submittedBy: userObj?.name || '',
        date: getISTDate(0),
        hodComments: ''
      },
      mdApproval: {
        mdCommentsDirection: '',
        correctiveActionsDecisions: '',
        mdName: '',
        mdNameSignature: '',
        approvalDate: ''
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Monthly Performance Report auto-compiled successfully!',
      data: compiledData
    });
  } catch (error) {
    console.error('Error auto-compiling monthly performance report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const saveMonthlyReport = async (req, res) => {
  try {
    const activeUserId = req.user.id || req.user._id;
    const {
      userId,
      monthStartDate,
      monthEndDate,
      basicDetails,
      overallKpiSummary,
      keyAchievements,
      projectCampaignStatus,
      financialSummary,
      teamHrOperationalSummary,
      nextMonthPlan,
      studentLeadsSummary,
      clientLeadsSummary,
      hodSubmission,
      mdApproval,
      status
    } = req.body;

    const targetUserId = userId || activeUserId;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatIST = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

    const start = monthStartDate || formatIST(firstDay);
    const end = monthEndDate || formatIST(lastDay);

    const report = await MonthlyPerformanceReport.findOneAndUpdate(
      { userId: targetUserId, monthStartDate: start, monthEndDate: end },
      {
        $set: {
          userId: targetUserId,
          monthStartDate: start,
          monthEndDate: end,
          basicDetails,
          overallKpiSummary,
          keyAchievements,
          projectCampaignStatus,
          financialSummary,
          teamHrOperationalSummary,
          nextMonthPlan,
          studentLeadsSummary,
          clientLeadsSummary,
          hodSubmission,
          mdApproval,
          status: status || 'Submitted'
        }
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Monthly Performance Report saved successfully!',
      data: report
    });
  } catch (error) {
    console.error('Error saving monthly performance report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateMDApproval = async (req, res) => {
  try {
    const { reportId, mdCommentsDirection, correctiveActionsDecisions, mdName, mdNameSignature, approvalDate } = req.body;

    const report = await MonthlyPerformanceReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          'mdApproval.mdCommentsDirection': mdCommentsDirection,
          'mdApproval.correctiveActionsDecisions': correctiveActionsDecisions,
          'mdApproval.mdName': mdName,
          'mdApproval.mdNameSignature': mdNameSignature,
          'mdApproval.approvalDate': approvalDate,
          status: 'Approved'
        }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'MD Approval updated successfully!',
      data: report
    });
  } catch (error) {
    console.error('Error updating MD approval for monthly report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
