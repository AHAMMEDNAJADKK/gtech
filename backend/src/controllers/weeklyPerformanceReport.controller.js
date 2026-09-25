import WeeklyPerformanceReport from '../models/weeklyPerformanceReport.model.js';
import DailyShiftReport from '../models/dailyShiftReport.model.js';
import User from '../models/user.model.js';

const getISTDate = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(d);
};

export const getWeeklyReport = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;

    let start = startDate || getISTDate(-6);
    let end = endDate || getISTDate(0);

    let report = await WeeklyPerformanceReport.findOne({
      userId: targetUserId,
      weekStartDate: start,
      weekEndDate: end
    });

    const userObj = await User.findById(targetUserId).populate('departmentId', 'name').populate('designationId', 'name');

    const defaultBasicDetails = {
      weekPeriod: `${start} to ${end}`,
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
    console.error('Error fetching weekly performance report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const autoCompileWeeklyReport = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const targetUserId = userId || req.user.id || req.user._id;

    let start = startDate || getISTDate(-6);
    let end = endDate || getISTDate(0);

    const userObj = await User.findById(targetUserId).populate('departmentId', 'name').populate('designationId', 'name');
    const shiftReports = await DailyShiftReport.find({
      userId: targetUserId,
      dateString: { $gte: start, $lte: end }
    }).sort({ dateString: 1 });

    const projectTasksMap = new Map();
    const kpiMap = new Map();
    const challengesList = [];
    const achievementsList = [];
    const nextWeekPlanList = [];
    const studentLeadsMap = new Map();
    const clientLeadsMap = new Map();

    shiftReports.forEach(r => {
      // 1. Major Tasks & Projects (grouped by Project Name across the 7 days)
      let currentProjectName = '';
      (r.planVsAchievement || []).forEach(t => {
        const rawProj = (t.taskActivity || '').trim();
        if (rawProj !== '') {
          currentProjectName = rawProj;
        }

        const targetText = (t.targetToday || '').trim();
        const actualText = (t.actualOutput || '').trim();
        const remarksText = (t.businessResultRemarks || '').trim();

        if (currentProjectName || targetText || actualText) {
          const projName = currentProjectName || 'General Tasks';
          if (!projectTasksMap.has(projName)) {
            projectTasksMap.set(projName, []);
          }

          // Directly fetch Actual Output from Daily Report (keep empty if blank)
          const actualOutputSummary = actualText || '';

          projectTasksMap.get(projName).push({
            taskProject: projName,
            plannedDate: r.dateString,
            actualCurrent: actualOutputSummary,
            status: t.status || 'Completed',
            ownerRemarks: remarksText
          });
        }
      });

      // 2. Department KPI Summary
      (r.departmentKeyMetrics || []).forEach(m => {
        if ((m.metricKpi || '').trim()) {
          const key = m.metricKpi.trim();
          if (!kpiMap.has(key)) {
            kpiMap.set(key, {
              kpi: key,
              weeklyTarget: m.target || '',
              actual: m.actual || '',
              achievementPct: m.achievementPct || '',
              trendStatus: 'On Track'
            });
          }
        }
      });

      // 3. Challenges & Support Needed
      (r.pendingBlockers || []).forEach(b => {
        if ((b.pendingTaskIssue || '').trim()) {
          challengesList.push({
            issueChallenge: b.pendingTaskIssue,
            impact: b.reasonBlocker || '',
            supportRequired: b.owner ? `Owner: ${b.owner}` : '',
            resolutionDate: b.expectedCompletion || r.dateString
          });
        }
      });

      // 4. Key Achievements
      (r.evidenceAttachments || []).forEach(e => {
        if ((e.workItem || '').trim()) {
          achievementsList.push({
            achievement: e.workItem,
            evidenceResultImpact: e.crmRecordUrlFileApproval || ''
          });
        }
      });

      // 5. Next Week Execution Plan from Tomorrow's Priorities
      (r.tomorrowPriorities || []).forEach(p => {
        if ((p.priorityText || '').trim()) {
          nextWeekPlanList.push({
            priority: 'High',
            owner: userObj?.name || '',
            targetExpectedResult: p.priorityText.trim(),
            deadline: r.dateString
          });
        }
      });

      // 6. Academic Counselor Lead Updates Aggregation over 7 Days
      (r.studentLeadsUpdate || []).forEach(item => {
        if ((item.activity || '').trim()) {
          const actKey = item.activity.trim();
          const countVal = parseFloat(item.count) || 0;
          if (!studentLeadsMap.has(actKey)) {
            studentLeadsMap.set(actKey, { count: countVal, remarks: item.remarks || '' });
          } else {
            const prev = studentLeadsMap.get(actKey);
            prev.count += countVal;
            if (item.remarks && !prev.remarks) prev.remarks = item.remarks;
          }
        }
      });

      (r.clientLeadsUpdate || []).forEach(item => {
        if ((item.activity || '').trim()) {
          const actKey = item.activity.trim();
          const countVal = parseFloat(item.count) || 0;
          if (!clientLeadsMap.has(actKey)) {
            clientLeadsMap.set(actKey, { count: countVal, remarks: item.remarks || '' });
          } else {
            const prev = clientLeadsMap.get(actKey);
            prev.count += countVal;
            if (item.remarks && !prev.remarks) prev.remarks = item.remarks;
          }
        }
      });
    });

    const majorTasksList = [];
    projectTasksMap.forEach((tasks) => {
      tasks.forEach(task => majorTasksList.push(task));
    });

    const studentLeadsSummary = Array.from(studentLeadsMap.entries()).map(([act, data]) => ({
      activity: act,
      weeklyTotal: String(data.count),
      remarks: data.remarks
    }));

    const clientLeadsSummary = Array.from(clientLeadsMap.entries()).map(([act, data]) => ({
      activity: act,
      weeklyTotal: String(data.count),
      remarks: data.remarks
    }));

    const compiledData = {
      basicDetails: {
        weekPeriod: `${start} to ${end}`,
        employeeName: userObj?.name || '',
        designation: userObj?.designationName || userObj?.designation || userObj?.designationId?.name || '',
        employeeId: userObj?.employeeId || '',
        department: userObj?.departmentName || userObj?.department || userObj?.departmentId?.name || '',
        hodTeamLead: userObj?.reportingManager || userObj?.name || '',
        totalTeamMembers: '1'
      },
      weeklyKpiSummary: Array.from(kpiMap.values()),
      keyAchievements: achievementsList,
      majorTasksProjects: majorTasksList,
      challengesSupport: challengesList,
      nextWeekPlan: nextWeekPlanList,
      studentLeadsSummary,
      clientLeadsSummary,
      hodSubmission: {
        submittedBy: userObj?.name || '',
        date: getISTDate(0),
        hodComments: ''
      },
      mdApproval: {
        mdReviewStatus: 'Approved',
        mdCommentsDirection: ''
      }
    };

    return res.status(200).json({
      success: true,
      data: compiledData
    });
  } catch (error) {
    console.error('Error auto-compiling weekly report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const saveWeeklyReport = async (req, res) => {
  try {
    const activeUserId = req.user.id || req.user._id;
    const {
      userId,
      weekStartDate,
      weekEndDate,
      basicDetails,
      weeklyKpiSummary,
      keyAchievements,
      majorTasksProjects,
      challengesSupport,
      nextWeekPlan,
      studentLeadsSummary,
      clientLeadsSummary,
      hodSubmission,
      mdApproval,
      status
    } = req.body;

    const targetUserId = userId || activeUserId;
    const start = weekStartDate || getISTDate(-6);
    const end = weekEndDate || getISTDate(0);

    const report = await WeeklyPerformanceReport.findOneAndUpdate(
      { userId: targetUserId, weekStartDate: start, weekEndDate: end },
      {
        $set: {
          userId: targetUserId,
          weekStartDate: start,
          weekEndDate: end,
          basicDetails,
          weeklyKpiSummary,
          keyAchievements,
          majorTasksProjects,
          challengesSupport,
          nextWeekPlan,
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
      message: 'Weekly Performance Report saved successfully!',
      data: report
    });
  } catch (error) {
    console.error('Error saving weekly performance report:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateMDApproval = async (req, res) => {
  try {
    const { reportId, mdCommentsDirection, priorityDecisionsApprovals, mdName, mdNameSignature, approvalDate } = req.body;

    const report = await WeeklyPerformanceReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          'mdApproval.mdCommentsDirection': mdCommentsDirection,
          'mdApproval.priorityDecisionsApprovals': priorityDecisionsApprovals,
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
    console.error('Error updating MD approval:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
