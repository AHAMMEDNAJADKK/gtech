// ===============================
// BACKEND: attendance.model.js
// ===============================

import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  date: {
    type: String,
    required: true
  },

  status: {
    type: String,
    default: 'PRESENT'
  },

  check_in_time: {
    type: Date,
    default: null
  },

  check_out_time: {
    type: Date,
    default: null
  },

  working_hours: {
    type: String,
    default: '0.00'
  },

  is_late: {
    type: Boolean,
    default: false
  },

  overtime: {
    type: String,
    default: '0.00'
  },

  role: {
    type: String,
    default: null
  },

  loginMethod: {
    type: String,
    default: 'credentials'
  }

}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

attendanceSchema.index(
  { user_id: 1, date: 1 },
  { unique: true }
);

const Attendance = mongoose.model(
  'Attendance',
  attendanceSchema
);

export default Attendance;