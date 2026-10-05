import mongoose from 'mongoose';

const installmentSchema = new mongoose.Schema({
  installmentNumber: { type: Number, required: true },
  title: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
    default: 'PENDING'
  },
  paidDate: { type: Date },
  paymentMethod: { type: String, default: '' },
  receiptNo: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { _id: true, timestamps: true });

const paymentHistorySchema = new mongoose.Schema({
  receiptNo: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: {
    type: String,
    enum: ['Online - Razorpay', 'Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'],
    default: 'Online - Razorpay'
  },
  transactionId: { type: String, default: '' },
  installmentIndex: { type: Number, default: -1 },
  notes: { type: String, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gatewayOrderId: { type: String, default: '' },
  gatewayPaymentId: { type: String, default: '' },
  gatewaySignature: { type: String, default: '' },
  gatewayStatus: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'SUCCESS' }
}, { _id: true, timestamps: true });

const studentFeeSchema = new mongoose.Schema({
  feeCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
  },
  enrollmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE'],
    default: 'PENDING',
    index: true
  },
  dueDate: {
    type: Date
  },
  installments: [installmentSchema],
  paymentHistory: [paymentHistorySchema],
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

studentFeeSchema.index({ studentId: 1, courseId: 1 });

const StudentFee = mongoose.models.StudentFee || mongoose.model('StudentFee', studentFeeSchema);
export default StudentFee;
