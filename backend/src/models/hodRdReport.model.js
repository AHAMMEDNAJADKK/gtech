import mongoose from 'mongoose';

const hodRdReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateString: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  basicDetails: {
    date: { type: String },
    day: { type: String },
    employeeName: { type: String },
    employeeId: { type: String },
    department: { type: String },
    designation: { type: String },
    shiftTiming: { type: String },
    reportingTo: { type: String },
    preparedTime: { type: String }
  },
  dailyTaskSummary: [
    {
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  developmentWorkReport: [
    {
      project: { type: String },
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remark: { type: String }
    }
  ],
  rdInnovationReport: [
    {
      activity: { type: String },
      dueDate: { type: String },
      details: { type: String },
      status: { type: String }
    }
  ],
  kpiTracking: [
    {
      project: { type: String },
      kpi: { type: String },
      target: { type: String },
      achieved: { type: String }
    }
  ],
  issuesSupportRequired: [
    {
      issue: { type: String },
      priority: { type: String },
      actionTaken: { type: String }
    }
  ],
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    hodName: { type: String },
    hodSignature: { type: String },
    hodDate: { type: String },
    managerName: { type: String },
    managerSignature: { type: String },
    managerDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
hodRdReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const HodRdReport = mongoose.model('HodRdReport', hodRdReportSchema);

export default HodRdReport;
