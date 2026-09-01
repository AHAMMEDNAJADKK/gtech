import mongoose from 'mongoose';

const videographerReportSchema = new mongoose.Schema({
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
    date: { type: String },
    day: { type: String },
    employeeId: { type: String },
    designation: { type: String, default: 'Videographer & Editor' },
    reportingTo: { type: String, default: 'CMO' },
    shiftTiming: { type: String, default: '9:00 AM - 5:00 PM' },
    preparedAt: { type: String }
  },
  taskLog: [
    {
      taskProjectName: { type: String },
      dueDate: { type: String },
      descriptionDetails: { type: String },
      startTime: { type: String },
      endTime: { type: String },
      status: { type: String },
      fileLink: { type: String }
    }
  ],
  keyNumbers: {
    videosCompleted: {
      target: { type: String },
      todaysCount: { type: String },
      notes: { type: String }
    },
    revisionsDone: {
      target: { type: String },
      todaysCount: { type: String },
      notes: { type: String }
    },
    clientDeliveries: {
      target: { type: String },
      todaysCount: { type: String },
      notes: { type: String }
    }
  },
  blockers: [
    {
      issue: { type: String },
      details: { type: String },
      priority: { type: String }
    }
  ],
  tomorrowTasks: [
    {
      task: { type: String },
      details: { type: String },
      notes: { type: String }
    }
  ],
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    videographerName: { type: String },
    videographerSignature: { type: String },
    submittedAt: { type: String },
    teamLeaderName: { type: String },
    approvedOn: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
videographerReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const VideographerReport = mongoose.model('VideographerReport', videographerReportSchema);

export default VideographerReport;
