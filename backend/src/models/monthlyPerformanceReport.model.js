import mongoose from 'mongoose';

const monthlyPerformanceReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  monthStartDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  monthEndDate: {
    type: String, // YYYY-MM-DD
    required: true
  },

  // 1. BASIC DETAILS
  basicDetails: {
    monthYear: { type: String, default: '' },
    employeeName: { type: String, default: '' },
    designation: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    department: { type: String, default: '' },
    hodTeamLead: { type: String, default: '' },
    totalTeamMembers: { type: String, default: '' }
  },

  // 2. OVERALL KPI SUMMARY
  overallKpiSummary: [
    {
      kpi: { type: String, default: '' },
      monthlyTarget: { type: String, default: '' },
      actual: { type: String, default: '' },
      achievementPct: { type: String, default: '' },
      statusTrend: { type: String, default: '' }
    }
  ],

  // 3. KEY ACHIEVEMENTS & BUSINESS IMPACT
  keyAchievements: [
    {
      achievement: { type: String, default: '' },
      evidenceImpact: { type: String, default: '' }
    }
  ],

  // 4. PROJECT / CAMPAIGN / DELIVERY STATUS
  projectCampaignStatus: [
    {
      projectCampaign: { type: String, default: '' },
      planned: { type: String, default: '' },
      actualPct: { type: String, default: '' },
      status: { type: String, default: 'In Progress' },
      clientOwner: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],

  // 5. FINANCIAL / COMMERCIAL SUMMARY (WHERE APPLICABLE)
  financialSummary: [
    {
      particulars: { type: String, default: '' },
      amountCount: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],

  // 6. TEAM / HR & OPERATIONAL SUMMARY
  teamHrOperationalSummary: [
    {
      metric: { type: String, default: '' },
      countResult: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],

  // 7. NEXT MONTH PLAN
  nextMonthPlan: [
    {
      priorityObjective: { type: String, default: 'High' },
      owner: { type: String, default: '' },
      targetResult: { type: String, default: '' },
      deadline: { type: String, default: '' }
    }
  ],

  // ACADEMIC COUNSELOR & TELECALLER EXTENSIONS
  studentLeadsSummary: [
    {
      activity: { type: String, default: '' },
      monthlyTotal: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],
  clientLeadsSummary: [
    {
      activity: { type: String, default: '' },
      monthlyTotal: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],

  // 8. HOD COMMENTS & SUBMISSION
  hodSubmission: {
    submittedBy: { type: String, default: '' },
    date: { type: String, default: '' },
    hodComments: { type: String, default: '' }
  },

  // 9. MD APPROVAL & COMMENTS
  mdApproval: {
    mdCommentsDirection: { type: String, default: '' },
    correctiveActionsDecisions: { type: String, default: '' },
    mdName: { type: String, default: '' },
    mdNameSignature: { type: String, default: '' },
    approvalDate: { type: String, default: '' }
  },

  status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Revision Required'], default: 'Submitted' }
}, {
  timestamps: true
});

monthlyPerformanceReportSchema.index({ userId: 1, monthStartDate: -1, monthEndDate: -1 });

const MonthlyPerformanceReport = mongoose.models.MonthlyPerformanceReport || mongoose.model('MonthlyPerformanceReport', monthlyPerformanceReportSchema);

export default MonthlyPerformanceReport;
