import mongoose from 'mongoose';

const calendarWorkSchema = new mongoose.Schema(
  {
    // ========== BASIC INFO ==========
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty']
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    contentType: {
      type: String,
      default: 'other'
    },

    // ========== ASSIGNMENT ==========
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required']
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    assignedDesignation: {
      type: String,
      default: ''
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },

    // ========== PROJECT / CLIENT ==========
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null
    },

    campaign: {
      type: String,
      trim: true,
      default: ''
    },

    // Optional link to task
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },

    // ========== WORK STATUS LIFECYCLE ==========
    workStatus: {
      type: String,
      enum: ['draft', 'in_progress', 'ready_for_review', 'approved', 'revision_requested', 'completed', 'cancelled'],
      default: 'draft'
    },

    workStatusHistory: [
      {
        status: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        changedAt: {
          type: Date,
          default: Date.now
        },
        notes: String
      }
    ],

    // ========== POSTING STATUS LIFECYCLE ==========
    postingStatus: {
      type: String,
      enum: ['not_scheduled', 'scheduled', 'ready_to_post', 'posted', 'missed', 'cancelled'],
      default: 'not_scheduled'
    },

    postingStatusHistory: [
      {
        status: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        changedAt: {
          type: Date,
          default: Date.now
        },
        notes: String
      }
    ],

    // ========== DATES ==========
    workDate: {
      type: Date,
      default: null
    },

    workDueDate: {
      type: Date,
      default: null
    },

    postingDate: {
      type: Date,
      default: null
    },

    postingTime: {
      type: String,
      default: '',
      // Format: "HH:MM" (24-hour, IST)
      match: [/^\d{2}:\d{2}$|^$/, 'postingTime must be in HH:MM format (24-hour)']
    },

    // Computed from postingDate + postingTime
    scheduledPostTime: {
      type: Date,
      default: null
    },

    actualPostTime: {
      type: Date,
      default: null
    },

    // ========== REMINDER TRACKING ==========
    reminderSent: {
      type: Boolean,
      default: false
    },

    reminderSentAt: {
      type: Date,
      default: null
    },

    lastReminderAt: {
      type: Date,
      default: null
    },

    // ========== POSTING INFORMATION ==========
    socialMediaLinks: [
      {
        platform: {
          type: String,
          enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'other'],
          default: 'other'
        },
        postUrl: String
      }
    ],

    contentUrl: {
      type: String,
      default: ''
    },

    imageUrl: {
      type: String,
      default: ''
    },

    // ========== COLLABORATION ==========
    approvalNotes: {
      type: String,
      default: ''
    },

    revisionNotes: {
      type: String,
      default: ''
    },

    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 2000
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // ========== UPDATE AUDIT LOGS ==========
    updateLogs: [
      {
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        updatedAt: {
          type: Date,
          default: Date.now
        },
        action: {
          type: String,
          default: 'Updated details'
        },
        notes: String
      }
    ],

    // ========== METADATA ==========
    isUrgent: {
      type: Boolean,
      default: false
    },

    isPriority: {
      type: Boolean,
      default: false
    },

    tags: [String]
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret._id) {
          ret.id = ret._id.toString();
        }
        if (!ret.date) {
          ret.date = ret.postingDate || ret.workDate || null;
        }
        if (!ret.status) {
          ret.status = ret.workStatus === 'completed' ? 'Completed' : (ret.workStatus || '');
        }
        return ret;
      }
    }
  }
);

// ========== INDEXES ==========
calendarWorkSchema.index({ assignedTo: 1, workStatus: 1 });
calendarWorkSchema.index({ postingDate: 1, postingStatus: 1 });
calendarWorkSchema.index({ createdBy: 1 });
calendarWorkSchema.index({ workDueDate: 1 });
calendarWorkSchema.index({ department: 1 });
calendarWorkSchema.index({ project: 1 });
calendarWorkSchema.index({ client: 1 });
calendarWorkSchema.index({ scheduledPostTime: 1, reminderSent: 1, postingStatus: 1 });

const CalendarWork = mongoose.model('CalendarWork', calendarWorkSchema);
export default CalendarWork;