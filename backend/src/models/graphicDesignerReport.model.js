import mongoose from 'mongoose';

const graphicDesignerReportSchema = new mongoose.Schema({
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
    designation: { type: String, default: 'Graphic Designer' },
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
    designsCompleted: {
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
  teamLeadKpi: [
    {
      taskProjectName: { type: String },
      assignedTo: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    designerName: { type: String },
    designerSignature: { type: String },
    submittedAt: { type: String },
    teamLeaderName: { type: String },
    approvedOn: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
graphicDesignerReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const GraphicDesignerReport = mongoose.model('GraphicDesignerReport', graphicDesignerReportSchema);

export default GraphicDesignerReport;
