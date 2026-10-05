import mongoose from 'mongoose';

const liveClassSchema = new mongoose.Schema({
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
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['Google Meet', 'Zoom', 'Other'],
    default: 'Google Meet'
  },
  meetingUrl: {
    type: String,
    required: true,
    trim: true
  },
  meetingId: {
    type: String,
    default: '',
    trim: true
  },
  passcode: {
    type: String,
    default: '',
    trim: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String,
    required: true,
    trim: true
  },
  endTime: {
    type: String,
    default: '',
    trim: true
  },
  durationMinutes: {
    type: Number,
    default: 60,
    min: 1
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING',
    index: true
  },
  recordingUrl: {
    type: String,
    default: '',
    trim: true
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

liveClassSchema.index({ batchId: 1, scheduledDate: 1 });
liveClassSchema.index({ courseId: 1, status: 1 });

const LiveClass = mongoose.models.LiveClass || mongoose.model('LiveClass', liveClassSchema);
export default LiveClass;
