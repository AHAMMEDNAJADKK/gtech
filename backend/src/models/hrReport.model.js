import mongoose from 'mongoose';

const hrReportSchema = new mongoose.Schema({
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
      remarks: { type: String }
    }
  ],
  employeeManagement: [
    {
      employeeName: { type: String },
      department: { type: String },
      attendance: { type: String }, // Present / Absent
      taskStatus: { type: String }, // Completed / Pending
      remarks: { type: String }
    }
  ],
  recruitmentReport: [
    {
      activity: { type: String },
      dueDate: { type: String }, // e.g. Applications Received, Interviews Conducted
      countStatus: { type: String }
    }
  ],
  attendanceLeave: [
    {
      category: { type: String }, // e.g. Present Employees, Absent Employees
      count: { type: String }
    }
  ],
  adminOperations: [
    {
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  documentationCompliance: [
    {
      activity: { type: String },
      dueDate: { type: String },
      status: { type: String } // e.g. Yes / No
    }
  ],
  kpiTracking: [
    {
      kpi: { type: String },
      status: { type: String }
    }
  ],
  issuesEscalations: [
    {
      issue: { type: String },
      priority: { type: String }, // High / Medium / Low
      actionTaken: { type: String }
    }
  ],
  nextDayActionPlan: { type: String },
  finalShiftHandover: [
    {
      item: { type: String },
      status: { type: String }
    }
  ],
  hrAdminComments: { type: String },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    hrName: { type: String },
    hrSignature: { type: String },
    hrDate: { type: String },
    cooName: { type: String },
    cooSignature: { type: String },
    cooDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
hrReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const HrReport = mongoose.model('HrReport', hrReportSchema);

export default HrReport;
