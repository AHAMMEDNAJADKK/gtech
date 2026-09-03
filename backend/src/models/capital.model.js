import mongoose from 'mongoose';

const subInvestorSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String, required: true },
  amount: { type: Number, default: 0 },
  openingBalance: { type: Number, default: 0 }
});

const paymentLogSchema = new mongoose.Schema({
  id: { type: String },
  date: { type: String, required: true },
  type: { type: String, default: 'Capital Addition' },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  referenceNo: { type: String, default: '' },
  remarks: { type: String, default: '' }
});

const capitalSchema = new mongoose.Schema({
  voucherNo: { type: String, required: true, unique: true },
  investorName: { type: String, required: true },
  innerInvestors: { type: String, default: '' },
  subInvestors: [subInvestorSchema],
  amount: { type: Number, required: true, default: 0 },
  openingBalance: { type: Number, default: 0 },
  date: { type: String, required: true },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  referenceNo: { type: String, default: '' },
  status: { type: String, default: 'Verified' },
  remarks: { type: String, default: '' },
  paymentLogs: [paymentLogSchema]
}, { timestamps: true });

export default mongoose.model('Capital', capitalSchema);
