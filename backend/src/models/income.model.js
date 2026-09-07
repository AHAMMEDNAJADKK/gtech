import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  department: { type: String, required: true },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  date: { type: Date, default: Date.now },
  referenceNo: { type: String, default: '' },
  description: { type: String, default: '' },
  sourceType: { type: String, enum: ['Academy', 'Client', 'General'], default: 'General' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  clientName: { type: String, default: '' },
  taxOption: { type: String, default: 'No GST' },
  gstCategory: { type: String, enum: ['CGST_SGST', 'IGST', 'UTGST', 'EXEMPT', 'NONE'], default: 'NONE' },
  gstRate: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Pending', 'Paid', 'Partially Paid', 'Overdue', 'Inactive', 'Cancelled'], default: 'Pending' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  dueDate: { type: Date },
  orderNumber: { type: String, default: '' },
  paymentTerms: { type: String, default: 'Due on Receipt' },
  accountsReceivable: { type: String, default: 'Accounts Receivable' },
  salesperson: { type: String, default: '' },
  subject: { type: String, default: '' },
  discountRate: { type: Number, default: 0 },
  discountType: { type: String, default: 'percent' },
  discountAmount: { type: Number, default: 0 },
  tdsAmount: { type: Number, default: 0 },
  tcsAmount: { type: Number, default: 0 },
  adjustment: { type: Number, default: 0 },
  receiptNo: { type: String, default: '' },
  receiptDate: { type: Date },
  receiptAmount: { type: Number, default: 0 },
  payments: [{
    receiptNo: { type: String, default: '' },
    receiptDate: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: 'Bank Transfer' },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  lineItems: [{
    description: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 }
  }],
  notes: { type: String, default: 'Thanks for your business.' },
  terms: { type: String, default: 'Payment due within 15 days.' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: 'Accountant' }
}, { timestamps: true });

const Income = mongoose.model('Income', incomeSchema);
export default Income;
