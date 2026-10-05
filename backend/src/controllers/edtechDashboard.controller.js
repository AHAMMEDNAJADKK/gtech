import Lead from '../models/lead.model.js';
import User from '../models/user.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import Enrollment from '../models/enrollment.model.js';
import StudentAttendance from '../models/studentattendance.js';
import AssignmentSubmission from '../models/assignmentSubmission.model.js';
import LiveClass from '../models/liveClass.model.js';
import Certificate from '../models/certificate.model.js';
import StudentFee from '../models/studentFee.model.js';

export const edtechDashboardController = {
  getDashboardStats: async (req, res) => {
    try {
      const now = new Date();
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const endOfToday = new Date(now.setHours(23, 59, 59, 999));

      const [
        totalEnquiries,
        activeLeads,
        followupsDue,
        convertedStudents,
        activeStudents,
        activeCourses,
        activeBatches,
        upcomingClassesCount,
        todayAttendance,
        pendingAssignments,
        certificatesIssued,
        feeAggregates,
        leadStatusBreakdown,
        recentEnquiries,
        upcomingClasses,
        recentEnrollments
      ] = await Promise.all([
        // 1. Total Enquiries
        Lead.countDocuments({}),

        // 2. Active Leads
        Lead.countDocuments({ status: { $in: ['New', 'Contacted', 'Follow Up', 'Interested'] } }),

        // 3. Follow-ups Due
        Lead.countDocuments({
          $or: [
            { nextFollowUpDate: { $lte: endOfToday } },
            { status: 'Follow Up' }
          ]
        }),

        // 4. Converted Students
        Lead.countDocuments({ status: 'Converted' }),

        // 5. Active Students
        User.countDocuments({
          $or: [{ role: 'student' }, { role_id: '10' }],
          status: 'active',
          isActive: true
        }),

        // 6. Active Courses
        Course.countDocuments({ status: 'ACTIVE' }),

        // 7. Active Batches
        Batch.countDocuments({ status: { $in: ['ONGOING', 'UPCOMING'] } }),

        // 8. Upcoming Live Classes
        LiveClass.countDocuments({ status: 'UPCOMING' }),

        // 9. Today's Attendance
        StudentAttendance.countDocuments({ date: todayStr, status: 'PRESENT' }),

        // 10. Pending Assignments
        AssignmentSubmission.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),

        // 11. Certificates Issued
        Certificate.countDocuments({ status: 'ISSUED' }),

        // 12. Fee Totals
        StudentFee.aggregate([
          {
            $group: {
              _id: null,
              totalCollected: { $sum: '$paidAmount' },
              totalDue: { $sum: '$dueAmount' },
              totalGross: { $sum: '$finalAmount' }
            }
          }
        ]),

        // Lead stages breakdown
        Lead.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),

        // Recent 5 leads
        Lead.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .select('leadName phone city status interestedService createdAt nextFollowUpDate')
          .lean(),

        // Next 5 upcoming classes
        LiveClass.find({ status: 'UPCOMING' })
          .sort({ scheduledDate: 1, startTime: 1 })
          .limit(5)
          .populate('courseId', 'courseName')
          .populate('batchId', 'batchName')
          .populate('instructorId', 'name')
          .lean(),

        // Recent 5 enrollments
        Enrollment.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('studentId', 'name email phone studentId')
          .populate('courseId', 'courseName')
          .populate('batchId', 'batchName')
          .lean()
      ]);

      const feeTotals = feeAggregates[0] || { totalCollected: 0, totalDue: 0, totalGross: 0 };

      // Map lead status breakdown
      const stageMap = {
        'New': 0,
        'Contacted': 0,
        'Follow Up': 0,
        'Interested': 0,
        'Converted': 0,
        'Lost': 0
      };
      leadStatusBreakdown.forEach(item => {
        if (item._id && stageMap[item._id] !== undefined) {
          stageMap[item._id] = item.count;
        }
      });

      return res.status(200).json({
        success: true,
        kpis: {
          totalEnquiries,
          activeLeads,
          followupsDue,
          convertedStudents,
          activeStudents,
          activeCourses,
          activeBatches,
          upcomingClasses: upcomingClassesCount,
          todayAttendance,
          pendingAssignments,
          feeCollected: feeTotals.totalCollected,
          feeDue: feeTotals.totalDue,
          feeGross: feeTotals.totalGross,
          certificatesIssued
        },
        leadStages: stageMap,
        recentEnquiries,
        upcomingClasses,
        recentEnrollments
      });
    } catch (error) {
      console.error('EdTech Dashboard Stats Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to compute EdTech dashboard metrics.', error: error.message });
    }
  }
};

export default edtechDashboardController;
