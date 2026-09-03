import mongoose from 'mongoose';

const hodMarketingReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateString: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  reportPeriod: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  basicDetails: {
    date: { type: String },
    day: { type: String },
    employeeName: { type: String },
    employeeId: { type: String },
    department: { type: String, default: 'Marketing & Creative' },
    designation: { type: String, default: 'HOD Marketing' },
    shiftTiming: { type: String, default: '9:00 AM - 5:00 PM' },
    reportingTo: { type: String, default: 'CMO / Director' },
    reportingTime: { type: String },
    preparedTime: { type: String }
  },
  kpiSummary: {
    totalAdSpend: { type: String, default: '0' },
    totalLeadsGenerated: { type: String, default: '0' },
    costPerLead: { type: String, default: '0' },
    avgCtr: { type: String, default: '0%' },
    graphicsCreated: { type: String, default: '0' },
    revisionsRate: { type: String, default: '0' },
    conversionRate: { type: String, default: '0%' },
    returnOnAdSpend: { type: String, default: '0x' },
    tasksAssignedByCount: { type: String, default: '0' },
    tasksAssignedToCount: { type: String, default: '0' },
    completedTasksCount: { type: String, default: '0' }
  },
  dailyTaskSummary: [
    {
      taskTitle: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  tasksAssignedByUser: [
    {
      taskTitle: { type: String },
      assignedToName: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      dueDate: { type: String },
      status: { type: String },
      remarks: { type: String }
    }
  ],
  kpiTracking: [
    {
      kpiName: { type: String },
      target: { type: String },
      achievedToday: { type: String },
      remarks: { type: String }
    }
  ],
  marketingCampaigns: [
    {
      campaignName: { type: String },
      channel: { type: String },
      adSpend: { type: Number, default: 0 },
      leadsGenerated: { type: Number, default: 0 },
      cpl: { type: Number, default: 0 },
      status: { type: String, default: 'Active' },
      remarks: { type: String }
    }
  ],
  graphicDesignTasks: [
    {
      taskProjectName: { type: String },
      assetType: { type: String, default: 'Social Media Graphic' },
      dueDate: { type: String },
      assetLink: { type: String },
      revisions: { type: String, default: '0' },
      status: { type: String, default: 'Completed' },
      remarks: { type: String }
    }
  ],
  videoDeliverables: [
    {
      videoTitle: { type: String },
      videoType: { type: String, default: 'Ad Video' },
      duration: { type: String },
      dueDate: { type: String },
      videoLink: { type: String },
      status: { type: String, default: 'Completed' },
      remarks: { type: String }
    }
  ],
  blockersTomorrowPlan: [
    {
      blockerIssue: { type: String },
      priority: { type: String, default: 'Medium' },
      tomorrowPlan: { type: String },
      notes: { type: String }
    }
  ],
  excludeTables: {
    type: Boolean,
    default: false
  },
  excludedSections: [{ type: String }],
  hiddenSections: { type: mongoose.Schema.Types.Mixed, default: {} },
  approval: {
    hodName: { type: String },
    hodSignature: { type: String },
    hodDate: { type: String },
    cmoName: { type: String },
    cmoApproval: { type: String, default: 'Pending' },
    approvedOn: { type: String }
  }
}, { timestamps: true });

// Guarantee one HOD Marketing report per user per day
hodMarketingReportSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const HodMarketingReport = mongoose.model('HodMarketingReport', hodMarketingReportSchema);

export default HodMarketingReport;
