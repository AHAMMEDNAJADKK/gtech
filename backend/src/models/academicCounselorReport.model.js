import mongoose from 'mongoose';

const academicCounselorReportSchema = new mongoose.Schema({
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
    designation: { type: String, default: 'Sales Executive / Tele Caller & Academic Counselor' },
    department: { type: String, default: 'Sales & Growth / Academy' },
    shiftTiming: { type: String, default: '9:00 AM - 5.00 PM' },
    reportingTo: { type: String, default: 'Manager - OPS Sales & Growth' }
  },
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
  clientSalesActivity: [
    {
      activity: { type: String },
      dueDate: { type: String },
      count: { type: String },
      digitalMktg: { type: String },
      web: { type: String },
      remarks: { type: String }
    }
  ],
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
  reportsCollectedDone: {
    type: Boolean,
    default: false
  },
  performanceKpis: [
    {
      kpi: { type: String },
      target: { type: String },
      achieved: { type: String }
    }
  ],
  issuesFeedback: [
    {
      issue: { type: String },
      priority: { type: String },
      supportNeeded: { type: String }
    }
  ],
  finalHandover: {
    crmUpdated: { type: String, default: 'No' },
    reportsSubmitted: { type: String, default: 'No' }
  },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    counselorName: { type: String },
    counselorSignature: { type: String },
    counselorDate: { type: String },
    managerName: { type: String },
    managerSignature: { type: String },
    managerDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
academicCounselorReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const AcademicCounselorReport = mongoose.model('AcademicCounselorReport', academicCounselorReportSchema);

export default AcademicCounselorReport;
