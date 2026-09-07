import mongoose from 'mongoose';

const operationAccountSchema = new mongoose.Schema({
  particulars: {
    type: String,
    required: true,
    trim: true
  },
  givenBy: {
    type: String,
    required: true,
    trim: true
  },
  givenTo: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

export default mongoose.model('OperationAccount', operationAccountSchema);
