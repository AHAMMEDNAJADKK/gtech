import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  topicId: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 1
  }
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  moduleId: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 1
  },
  topics: [topicSchema]
}, { _id: false });

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'Web Development',
    index: true
  },
  shortDescription: {
    type: String,
    default: '',
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  durationValue: {
    type: Number,
    required: true,
    min: 1,
    default: 6
  },
  durationUnit: {
    type: String,
    enum: ['Days', 'Weeks', 'Months', 'Years'],
    default: 'Months'
  },
  courseFee: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },
  syllabus: [moduleSchema],
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

courseSchema.index({ category: 1, status: 1 });

if (mongoose.models.Course) {
  delete mongoose.models.Course;
}

const Course = mongoose.model('Course', courseSchema);

export default Course;
