import mongoose from 'mongoose';

const clientMeetingSchema = new mongoose.Schema({
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
  date: {
    type: String,
    required: true,
    trim: true
  },
  time: {
    type: String,
    default: '10:00 AM',
    trim: true
  },
  type: {
    type: String,
    default: 'Online (Google Meet)',
    trim: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled', 'Postponed'],
    default: 'Scheduled'
  },
  attendees: {
    type: String,
    default: 'Account Manager',
    trim: true
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

clientMeetingSchema.index({ client: 1, date: 1 });
clientMeetingSchema.index({ status: 1 });

const ClientMeeting = mongoose.model('ClientMeeting', clientMeetingSchema);
export default ClientMeeting;
