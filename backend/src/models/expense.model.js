import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: false
  },
  categoryName: {
    type: String,
    required: true
  },
  isPurchase: {
    type: Boolean,
    default: false
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI', 'Bank Transfer'],
    default: 'Cash',
    required: true
  },
  paidTo: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  attachment: {
    type: String,
    default: ''
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  addedByName: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['Expense', 'Salary', 'Purchase'],
    default: 'Expense'
  },
  taxOption: {
    type: String,
    default: 'No GST'
  },
  gstCategory: {
    type: String,
    enum: ['CGST_SGST', 'IGST', 'UTGST', 'EXEMPT', 'NONE'],
    default: 'NONE'
  },
  gstRate: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  cgstAmount: {
    type: Number,
    default: 0
  },
  sgstAmount: {
    type: Number,
    default: 0
  },
  igstAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  salaryPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryPayment'
  },
  status: {
    type: String,
    enum: ['APPROVED', 'PENDING', 'REJECTED'],
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
  collection: 'expenses'
});

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ type: 1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
