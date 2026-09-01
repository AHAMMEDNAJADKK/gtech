import mongoose from 'mongoose';

const opsReportSchema = new mongoose.Schema({
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
  dailyOperations: [
    {
      activity: { type: String },
      dueDate: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      status: { type: String },
      remarks: { type: String },
      isTodoTask: { type: Boolean, default: false }
    }
  ],
  salesActivity: [
    {
      activity: { type: String },
      dueDate: { type: String },
      count: { type: String },
      digitalMktg: { type: String },
      web: { type: String },
      remarks: { type: String }
    }
  ],
  salesPerformance: [
    {
      staffName: { type: String },
      taskAssigned: { type: String },
      leads: { type: String },
      closings: { type: String },
      status: { type: String }
    }
  ],
  revenueTracking: [
    {
      category: { type: String },
      amount: { type: String }
    }
  ],
  academyStatus: [
    {
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
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
  issuesEscalations: [
    {
      issue: { type: String },
      priority: { type: String },
      actionTaken: { type: String }
    }
  ],
  handover: {
    pendingLeadsShared: { type: String },
    crmUpdated: { type: String },
    reportsSubmitted: { type: String },
    teamUpdated: { type: String }
  },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    opsName: { type: String },
    opsSignature: { type: String },
    opsDate: { type: String },
    directorName: { type: String },
    directorSignature: { type: String },
    directorDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
opsReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const OpsReport = mongoose.model('OpsReport', opsReportSchema);

export default OpsReport;
