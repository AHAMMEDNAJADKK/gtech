import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'dropped', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED'],
    default: 'active',
    set: v => String(v).toLowerCase(),
    index: true
  },
  totalModules: {
    type: Number,
    default: 10,
    min: 1
  },
  completedModules: {
    type: Number,
    default: 0,
    min: 0
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index to quickly query student enrollments by batch and status
enrollmentSchema.index({ studentId: 1, batchId: 1, status: 1 });

const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);

export default Enrollment;
