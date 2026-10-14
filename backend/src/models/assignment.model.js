import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  moduleId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
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
  instructions: {
    type: String,
    default: '',
    trim: true
  },
  attachmentUrl: {
    type: String,
    default: ''
  },
  maxMarks: {
    type: Number,
    required: true,
    default: 100,
    min: 1
  },
  dueDate: {
    type: Date,
    default: null
  },
  allowedSubmissionTypes: [{
    type: String,
    enum: ['FILE', 'TEXT', 'LINK'],
    default: 'FILE'
  }],
  isPublished: {
    type: Boolean,
    default: true,
    index: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null,
    index: true
  },
  assignedMentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  targetType: {
    type: String,
    enum: ['ALL', 'BATCH', 'STUDENTS'],
    default: 'ALL'
  },
  targetStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  allowedFileFormats: {
    type: [String],
    default: ['pdf', 'jpg', 'jpeg', 'png']
  },
  maxFileSize: {
    type: Number,
    default: 10485760 // 10MB in bytes
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED'],
    default: 'PUBLISHED',
    index: true
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

assignmentSchema.index({ courseId: 1, moduleId: 1, isPublished: 1 });

const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);

export default Assignment;
