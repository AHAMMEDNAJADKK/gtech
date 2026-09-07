import mongoose from 'mongoose';

const clientFollowupSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: String,
    required: true,
    trim: true
  },
  dueTime: {
    type: String,
    default: '03:00 PM',
    trim: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'High'
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'In Progress'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: '',
    trim: true
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

clientFollowupSchema.index({ client: 1, dueDate: 1 });
clientFollowupSchema.index({ status: 1 });

const ClientFollowup = mongoose.model('ClientFollowup', clientFollowupSchema);
export default ClientFollowup;
