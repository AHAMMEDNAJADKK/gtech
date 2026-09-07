import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  employeeId: {
    type: String
  },
  userName: {
    type: String
  },
  userEmail: {
    type: String
  },
  department: {
    type: String
  },
  reportingManager: {
    type: String
  },
  ccUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: {
      type: String
    },
    email: {
      type: String
    }
  }],

  leaveType: {
    type: String,
    enum: ['Personal Leave', 'Sick Leave', 'Half Day', 'Other'],
    required: [true, 'Leave type is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  totalDays: {
    type: Number,
    required: true,
    default: 1
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true
  },

  // Team Lead Approval Status
  teamLeadStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  teamLeadComment: {
    type: String,
    default: ''
  },
  teamLeadActionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  teamLeadActionAt: {
    type: Date
  },

  // HR / Admin Approval Status
  hrStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  hrComment: {
    type: String,
    default: ''
  },
  hrActionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hrActionAt: {
    type: Date
  },

  // Aggregate Overall Status
  finalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING'
  },

  // HR & MD Approval Flags
  isHrRequest: {
    type: Boolean,
    default: false
  },
  requiresMdApproval: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

leaveRequestSchema.index({ user: 1, createdAt: -1 });
leaveRequestSchema.index({ finalStatus: 1 });
leaveRequestSchema.index({ reportingManager: 1 });

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
