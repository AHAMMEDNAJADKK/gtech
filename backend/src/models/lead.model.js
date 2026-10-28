import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  leadName: {
    type: String,
    required: true,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    trim: true
  },
  interestedService: {
    type: String,
    trim: true
  },
  campaignName: {
    type: String,
    trim: true
  },
  leadPlatform: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  clientMeetingFixed: {
    type: String,
    enum: ['Yes', 'No', 'Pending', ''],
    default: ''
  },
  admissionYesNo: {
    type: String,
    enum: ['Yes', 'No', 'Pending', ''],
    default: ''
  },
  remarks: {
    type: String
  },
  nextFollowUpDate: {
    type: Date
  },
  leadsReceivedDate: {
    type: Date
  },
  followUpDate1: {
    type: Date
  },
  followUpDate2: {
    type: Date
  },
  followUpDate3: {
    type: Date
  },
  followUpDate4: {
    type: Date
  },
  followUpDate5: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  convertedAt: {
    type: Date
  },
  lostReason: {
    type: String
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
  },
  toObject: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index searching support
leadSchema.index({ leadName: 'text', email: 'text', phone: 'text', companyName: 'text' });

// Performance optimization indexes
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ city: 1 });

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;

