import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  month: {
    type: String, // e.g. "July 2026" or "2026-07"
    required: true
  },
  basicSalary: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI'],
    default: 'Bank',
    required: true
  },
  remarks: {
    type: String,
    default: ''
  },

  // Detailed Payslip Header & Attendance Fields (from KOD.BRAND official format)
  kbEmployeeId: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: 'HEAD OFFICE'
  },
  payPeriod: {
    type: String,
    default: ''
  },
  payDateStr: {
    type: String,
    default: ''
  },
  workingDays: {
    type: Number,
    default: 27
  },
  daysWorked: {
    type: Number,
    default: 27
  },
  daysInLeave: {
    type: Number,
    default: 0
  },
  companyName: {
    type: String,
    default: 'KODBRAND SOLUTIONS'
  },
  companyAddressLine1: {
    type: String,
    default: '3rd Floor, Aranyakam Building'
  },
  companyAddressLine2: {
    type: String,
    default: 'thamarauzhi road, up hill'
  },
  companyAddressLine3: {
    type: String,
    default: 'malappuram, kerala-676505'
  },
  signatoryName: {
    type: String,
    default: 'Aoj.'
  },
  signatoryTitle: {
    type: String,
    default: 'Authorized Signature'
  },
  customNetPay: {
    type: Number
  },

  // Earnings Breakdown
  hra: {
    type: Number,
    default: 0
  },
  medicalAllowance: {
    type: Number,
    default: 0
  },
  specialAllowance: {
    type: Number,
    default: 0
  },
  transportAllowance: {
    type: Number,
    default: 0
  },
  otherAllowance: {
    type: Number,
    default: 0
  },
  integrityAward: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },

  // Deductions Breakdown
  pf: {
    type: Number,
    default: 0
  },
  professionalTax: {
    type: Number,
    default: 0
  },
  incomeTax: {
    type: Number,
    default: 0
  },
  unpaidLeave: {
    type: Number,
    default: 0
  },
  advanceSalary: {
    type: Number,
    default: 0
  },
  otherDeductions: {
    type: Number,
    default: 0
  },
  totalDeductions: {
    type: Number,
    default: 0
  },

  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  addedByName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  actionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actionByName: {
    type: String,
    default: ''
  },
  actionAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'salary_payments'
});

salaryPaymentSchema.index({ paymentDate: -1 });
salaryPaymentSchema.index({ employee: 1, month: 1 });

const SalaryPayment = mongoose.model('SalaryPayment', salaryPaymentSchema);
export default SalaryPayment;
