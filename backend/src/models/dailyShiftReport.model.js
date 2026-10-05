import mongoose from 'mongoose';

const dailyShiftReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateString: {
    type: String, // YYYY-MM-DD format (IST)
    required: true
  },
  employeeShiftDetails: {
    date: { type: String },
    employeeName: { type: String },
    employeeId: { type: String },
    department: { type: String },
    designation: { type: String },
    reportingTo: { type: String },
    shiftTiming: { type: String },
    workMode: { type: String, enum: ['Office', 'WFH', 'Field'], default: 'Office' }
  },
  planVsAchievement: [
    {
      taskActivity: { type: String, default: '' },
      targetToday: { type: String, default: '' },
      actualOutput: { type: String, default: '' },
      status: { type: String, enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'], default: 'Completed' },
      businessResultRemarks: { type: String, default: '' }
    }
  ],
  departmentKeyMetrics: [
    {
      metricKpi: { type: String, default: '' },
      target: { type: String, default: '' },
      actual: { type: String, default: '' },
      achievementPct: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],
  evidenceAttachments: [
    {
      workItem: { type: String, default: '' },
      crmRecordUrlFileApproval: { type: String, default: '' }
    }
  ],
  pendingBlockers: [
    {
      pendingTaskIssue: { type: String, default: '' },
      reasonBlocker: { type: String, default: '' },
      owner: { type: String, default: '' },
      expectedCompletion: { type: String, default: '' }
    }
  ],
  tomorrowPriorities: [
    {
      priorityText: { type: String, default: '' }
    }
  ],
  studentLeadsUpdate: [
    {
      activity: { type: String, default: '' },
      count: { type: String, default: '' },
      digitalMktg: { type: String, default: '' },
      web: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],
  clientLeadsUpdate: [
    {
      activity: { type: String, default: '' },
      count: { type: String, default: '' },
      digitalMktg: { type: String, default: '' },
      web: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  ],
  handoverFinalConfirmation: {
    handoverRequired: { type: String, enum: ['Yes', 'No'], default: 'No' },
    handoverTo: { type: String, default: '' },
    crmUpdated: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    reportSubmitted: { type: String, enum: ['Yes', 'No'], default: 'Yes' },
    employeeComment: { type: String, default: '' }
  },
  status: { type: String, enum: ['Draft', 'Submitted'], default: 'Submitted' }
}, {
  timestamps: true
});

dailyShiftReportSchema.index({ userId: 1, dateString: -1 });

const DailyShiftReport = mongoose.models.DailyShiftReport || mongoose.model('DailyShiftReport', dailyShiftReportSchema);

export default DailyShiftReport;
