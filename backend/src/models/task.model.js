import mongoose from 'mongoose';

const TASK_STATUSES = [
  'pending',
  'current',
  'preview',
  'in-progress',
  'in_progress',
  'completed',
  'done',
  'cancelled',
  'on-hold',
  'on_hold',
  'review',
  'under-review',
  'under_review',
  'testing'
];

const TASK_PRIORITIES = [
  'low',
  'medium',
  'high'
];

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  assigned_to: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  designation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation'
  },
  client: {
    type: String,
    default: '',
    trim: true
  },
  project: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: TASK_STATUSES,
    default: 'pending'
  },
  priority: {
    type: String,
    enum: TASK_PRIORITIES,
    default: 'medium'
  },
  dueDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    }
  }
});

taskSchema.index({ assigned_to: 1, dueDate: 1, status: 1 });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

export default Task;
