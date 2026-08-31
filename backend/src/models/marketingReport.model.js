import mongoose from 'mongoose';

const marketingReportSchema = new mongoose.Schema({
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
    employeeName: { type: String },
    employeeId: { type: String },
    designation: { type: String },
    reportingTo: { type: String },
    date: { type: String },
    day: { type: String },
    shiftTiming: { type: String },
    preparedTime: { type: String }
  },
  taskSummary: [
    {
      task: { type: String },
      dueDate: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      detailsNotes: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  keyNumbers: [
    {
      kpi: { type: String },
      target: { type: String },
      achievedToday: { type: String },
      notes: { type: String }
    }
  ],
  blockersTomorrowPlan: [
    {
      blockersToday: { type: String },
      priority: { type: String },
      tomorrowMainTask: { type: String },
      notes: { type: String }
    }
  ],
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    staffName: { type: String },
    staffSignature: { type: String },
    submittedAt: { type: String },
    leaderName: { type: String },
    leaderApproval: { type: String },
    approvedOn: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
marketingReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const MarketingReport = mongoose.model('MarketingReport', marketingReportSchema);

export default MarketingReport;
