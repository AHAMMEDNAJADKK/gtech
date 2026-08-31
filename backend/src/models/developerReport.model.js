import mongoose from 'mongoose';

const developerReportSchema = new mongoose.Schema({
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
      startDate: { type: String },
      endDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  developmentTaskReport: [
    {
      project: { type: String },
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remark: { type: String }
    }
  ],
  researchLearning: [
    {
      activity: { type: String },
      dueDate: { type: String },
      details: { type: String }
    }
  ],
  performanceTracker: {
    taskCompleted: { type: String, default: 'Good' },
    learningProgress: { type: String, default: 'Improving' },
    communication: { type: String, default: 'Good' },
    attendance: { type: String, default: 'Present' },
    productivity: { type: String, default: 'Present' }
  },
  toolsUsed: { type: String },
  challengesFaced: { type: String },
  nextDayPlan: { type: String },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    internName: { type: String },
    internSignature: { type: String },
    internDate: { type: String },
    hodName: { type: String },
    hodSignature: { type: String },
    hodDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
developerReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const DeveloperReport = mongoose.model('DeveloperReport', developerReportSchema);

export default DeveloperReport;
