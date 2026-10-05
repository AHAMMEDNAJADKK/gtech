import mongoose from 'mongoose';

const employeeTrainingSchema = new mongoose.Schema({
  courseName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
    enum: [
      'General',
      'Onboarding & Induction',
      'HR & Policy',
      'Sales & CRM Skills',
      'Technical Training',
      'Design & Content',
      'Marketing & Digital',
      'Leadership & Management',
      'Compliance & Safety',
      'Accounts & Finance',
      'Occasional'
    ]
  },
  description: {
    type: String,
    default: ''
  },
  trainer: {
    type: String,
    default: '',
    trim: true
  },
  startDate: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: null
  },
  materialsUrl: {
    type: String,
    default: '',
    trim: true
  },
  modules: [
    {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      resourceUrl: { type: String, default: '' }
    }
  ],
  durationValue: {
    type: Number,
    default: 1,
    min: 1
  },
  durationUnit: {
    type: String,
    enum: ['Hours', 'Days', 'Weeks', 'Months'],
    default: 'Days'
  },
  targetAudience: {
    type: String,
    default: 'ALL',
    trim: true
  },
  isMandatory: {
    type: Boolean,
    default: false
  },
  isOccasional: {
    type: Boolean,
    default: false
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DRAFT', 'COMPLETED', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },
  // Employees assigned to this training
  assignedEmployees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  // Per-employee completion & assessment tracking
  employeeProgress: [
    {
      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
        default: 'NOT_STARTED'
      },
      progressPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      completedModules: [{
        type: Number
      }],
      score: {
        type: Number,
        default: null
      },
      remarks: {
        type: String,
        default: ''
      },
      completedAt: {
        type: Date,
        default: null
      }
    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const EmployeeTraining = mongoose.model('EmployeeTraining', employeeTrainingSchema);
export default EmployeeTraining;
