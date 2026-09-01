import mongoose from 'mongoose';

const employeeReportsSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee ID is required']
  },
  pdf_url: {
    type: String,
    default: ''
  },
  pdf_public_id: {
    type: String
  },
  pdf_data: {
    type: Buffer,
    select: false
  },
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  report_date: {
    type: String, // YYYY-MM-DD or date range e.g., 'YYYY-MM-DD_to_YYYY-MM-DD'
    required: [true, 'Report date is required']
  },
  report_type: {
    type: String, // e.g., 'developer', 'hr', etc.
    required: [true, 'Report type is required']
  },
  report_period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Performance optimization indexes
employeeReportsSchema.index({ employee_id: 1, report_date: -1 });
employeeReportsSchema.index({ created_at: -1 });

const EmployeeReports = mongoose.model('EmployeeReports', employeeReportsSchema);

export default EmployeeReports;
