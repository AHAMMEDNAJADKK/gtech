import mongoose from 'mongoose';

const accountantReportSchema = new mongoose.Schema({
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
  dailyAccountingSummary: [
    {
      activity: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  dailyTasks: [
    {
      activity: { type: String },
      dueDate: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  transactionReport: [
    {
      transactionType: { type: String },
      amount: { type: String },
      incomes: { type: String },
      expense: { type: String }
    }
  ],
  invoiceBillingReport: [
    {
      clientVendor: { type: String },
      type: { type: String },
      amount: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  payrollPaymentStatus: [
    {
      activity: { type: String },
      amount: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  expenseTracking: [
    {
      category: { type: String },
      amount: { type: String },
      remarks: { type: String }
    }
  ],
  documentationCompliance: [
    {
      activity: { type: String },
      status: { type: String }
    }
  ],
  kpiTracking: [
    {
      kpi: { type: String },
      targetAchieved: { type: String }
    }
  ],
  issuesSupportRequired: [
    {
      issue: { type: String },
      priority: { type: String },
      action: { type: String }
    }
  ],
  nextDayTaskPlan: [
    { type: String }
  ],
  finalShiftHandover: [
    {
      item: { type: String },
      status: { type: String }
    }
  ],
  accountantComments: {
    type: String
  },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    accountantName: { type: String },
    accountantSignature: { type: String },
    accountantDate: { type: String },
    managerName: { type: String },
    managerSignature: { type: String },
    managerDate: { type: String }
  }
}, { timestamps: true });

// Compound index to guarantee one report per user per day
accountantReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const AccountantReport = mongoose.model('AccountantReport', accountantReportSchema);

export default AccountantReport;
