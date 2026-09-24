import mongoose from 'mongoose';

// Daily Routine Item (checklist item like 09:30 Attendance & Check-in)
const dailyRoutineSchema = new mongoose.Schema({
  dateString: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  time: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedByName: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date
  }
}, { timestamps: true });

// Routine Template for recurring milestones from a date onwards
const routineTemplateSchema = new mongoose.Schema({
  time: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  startDateString: {
    type: String,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Department Daily Briefing
const departmentBriefingSchema = new mongoose.Schema({
  dateString: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  department: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    default: ''
  },
  deliverables: {
    type: String,
    default: ''
  },
  blockers: {
    type: String,
    default: ''
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedByName: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// EOD Closure Report
const eodClosureSchema = new mongoose.Schema({
  dateString: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  completedToday: {
    type: String,
    default: ''
  },
  pendingReason: {
    type: String,
    default: ''
  },
  tomorrowPriority: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Manager To-Do Checklist Item
const managerToDoSchema = new mongoose.Schema({
  dateString: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  task: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    default: 'General'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedToName: {
    type: String,
    default: ''
  },
  assignedToEmail: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdByName: {
    type: String,
    default: ''
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedByName: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date
  }
}, { timestamps: true });

export const DailyRoutine = mongoose.model('DailyRoutine', dailyRoutineSchema);
export const RoutineTemplate = mongoose.model('RoutineTemplate', routineTemplateSchema);
export const DepartmentBriefing = mongoose.model('DepartmentBriefing', departmentBriefingSchema);
export const EodClosure = mongoose.model('EodClosure', eodClosureSchema);
export const ManagerToDo = mongoose.model('ManagerToDo', managerToDoSchema);

