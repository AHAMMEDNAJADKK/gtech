import mongoose from 'mongoose';

const openingBalanceSchema = new mongoose.Schema({
  incomeAmount: {
    type: Number,
    required: true,
    default: 0
  },
  expenseAmount: {
    type: Number,
    required: true,
    default: 0
  },
  // Legacy single amount field kept for backwards compatibility
  amount: {
    type: Number,
    default: 0
  },
  asOfDate: {
    type: Date,
    default: Date.now
  },
  paymentMode: {
    type: String,
    enum: ['ALL', 'CASH', 'BANK', 'ONLINE', 'UPI', 'CARD'],
    default: 'ALL'
  },
  note: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const OpeningBalance = mongoose.model('OpeningBalance', openingBalanceSchema);

export default OpeningBalance;
