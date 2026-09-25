import mongoose from 'mongoose';

const weeklyPerformanceReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weekStartDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  weekEndDate: {
    type: String, // YYYY-MM-DD
    required: true
  },

  // 1. BASIC DETAILS
  basicDetails: {
    weekPeriod: { type: String, default: '' },
    employeeName: { type: String, default: '' },
    designation: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    department: { type: String, default: '' },
    hodTeamLead: { type: String, default: '' },
    totalTeamMembers: { type: String, default: '' }
  },

  // 2. WEEKLY KPI SUMMARY
  weeklyKpiSummary: [
    {
      kpi: { type: String, default: '' },
      weeklyTarget: { type: String, default: '' },
      actual: { type: String, default: '' },
      achievementPct: { type: String, default: '' },
      trendStatus: { type: String, default: '' }
    }
  ],

  // 3. KEY ACHIEVEMENTS & BUSINESS IMPACT
  keyAchievements: [
    {
      achievement: { type: String, default: '' },
      evidenceResultImpact: { type: String, default: '' }
    }
  ],

  // 4. MAJOR TASKS / PROJECTS
  majorTasksProjects: [
    {
      taskProject: { type: String, default: '' },
      plannedDate: { type: String, default: '' },
      actualCurrent: { type: String, default: '' },
      status: { type: String, default: 'In Progress' },
      ownerRemarks: { type: String, default: '' }
    }
  ],

  // 5. CHALLENGES / SUPPORT NEEDED
  challengesSupport: [
    {
      issueChallenge: { type: String, default: '' },
      impact: { type: String, default: '' },
      supportRequired: { type: String, default: '' },
      resolutionDate: { type: String, default: '' }
    }
  ],

  // 6. NEXT WEEK EXECUTION PLAN
  nextWeekPlan: [
    {
      priority: { type: String, default: 'High' },
      owner: { type: String, default: '' },
      targetExpectedResult: { type: String, default: '' },
      deadline: { type: String, default: '' }
    }
  ],

  // ACADEMIC COUNSELOR EXTENSIONS
  studentLeadsSummary: [
    {
      activity: { type: String, default: '' },
      weeklyTotal: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],
  clientLeadsSummary: [
    {
      activity: { type: String, default: '' },
      weeklyTotal: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],

  // 7. HOD SUBMISSION & COMMENTS
  hodSubmission: {
    submittedBy: { type: String, default: '' },
    date: { type: String, default: '' },
    hodComments: { type: String, default: '' }
  },

  // 8. MD APPROVAL & COMMENTS
  mdApproval: {
    mdReviewStatus: { type: String, default: 'Approved' },
    mdCommentsDirection: { type: String, default: '' },
    priorityDecisionsApprovals: { type: String, default: '' },
    mdName: { type: String, default: '' },
    mdNameSignature: { type: String, default: '' },
    approvalDate: { type: String, default: '' }
  },

  status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Revision Required'], default: 'Submitted' }
}, {
  timestamps: true
});

weeklyPerformanceReportSchema.index({ userId: 1, weekStartDate: -1, weekEndDate: -1 });

const WeeklyPerformanceReport = mongoose.models.WeeklyPerformanceReport || mongoose.model('WeeklyPerformanceReport', weeklyPerformanceReportSchema);

export default WeeklyPerformanceReport;
