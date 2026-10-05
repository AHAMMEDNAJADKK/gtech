import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Client from '../models/client.model.js';
import Lead from '../models/lead.model.js';
import Task from '../models/task.model.js';
import Attendance from '../models/attendance.model.js';
import Student from '../models/student.js';
import Project from '../models/project.model.js';
import Expense from '../models/expense.model.js';
import Income from '../models/income.model.js';
import OpeningBalance from '../models/openingBalance.model.js';

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

export const mdDashboardController = {
  /**
   * GET /api/v1/md-dashboard
   * Returns aggregated executive metrics for MD Dashboard
   */
  getMdMetrics: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;

      // Start of current month calculation
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const startOfMonthISO = startOfMonth.toISOString().split('T')[0];

      // 1. TOP SUMMARY CARDS
      const activeClientsCount = await Client.countDocuments({ status: { $regex: /^active$/i } });
      
      let activeStudentsCount = 0;
      let newStudentsThisMonthCount = 0;
      let recentStudents = [];

      // Query Student model if available
      let studentDocCount = 0;
      let studentDocNewThisMonth = 0;
      let studentDocs = [];

      if (Student) {
        studentDocCount = await Student.countDocuments({ status: { $ne: 'inactive' } });
        studentDocNewThisMonth = await Student.countDocuments({
          $or: [
            { createdAt: { $gte: startOfMonth } },
            { admission_date: { $gte: startOfMonthISO } }
          ]
        });
        studentDocs = await Student.find({})
          .select('name email phone status admission_date profile_image createdAt')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
      }

      // Query User model for users with role 'student' or role_id '4' or '10'
      const userStudentQuery = {
        $or: [
          { role: { $regex: /^student$/i } },
          { role_id: '4' },
          { role_id: 4 },
          { role_id: '10' },
          { role_id: 10 }
        ]
      };
      const userStudentCount = await User.countDocuments(userStudentQuery);
      const userStudentNewThisMonth = await User.countDocuments({
        ...userStudentQuery,
        createdAt: { $gte: startOfMonth }
      });
      const userStudentDocs = await User.find(userStudentQuery)
        .select('name email phone status profile_image avatar createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      activeStudentsCount = Math.max(studentDocCount, userStudentCount);
      newStudentsThisMonthCount = Math.max(studentDocNewThisMonth, userStudentNewThisMonth);

      const mergedStudentMap = new Map();
      [...studentDocs, ...userStudentDocs].forEach(st => {
        const key = String(st.email || st.name || st._id).toLowerCase();
        if (!mergedStudentMap.has(key)) {
          mergedStudentMap.set(key, {
            id: st._id,
            name: st.name,
            email: st.email || 'N/A',
            phone: st.phone || 'N/A',
            status: st.status || 'Active',
            admission_date: st.admission_date || (st.createdAt ? new Date(st.createdAt).toLocaleDateString() : 'N/A')
          });
        }
      });
      recentStudents = Array.from(mergedStudentMap.values()).slice(0, 8);

      const activeEmployeesCount = await User.countDocuments({
        status: { $regex: /^active$/i },
        isActive: { $ne: false }
      });
      const totalEmployeesCount = await User.countDocuments({});

      // 2. SALES & GROWTH TAB METRICS & LEAD FUNNEL
      const totalLeads = await Lead.countDocuments({});
      const convertedLeads = await Lead.countDocuments({ status: { $regex: /^converted$/i } });
      const newLeadsCount = await Lead.countDocuments({ status: { $regex: /^new$/i } });
      const contactedLeadsCount = await Lead.countDocuments({ status: { $regex: /^contacted$/i } });
      const inProgressLeadsCount = await Lead.countDocuments({ status: { $regex: /in_progress|followup|interested/i } });
      const lostLeadsCount = await Lead.countDocuments({ status: { $regex: /^lost|dropped|rejected$/i } });
      const conversionRateVal = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';

      // Top Performing Staff (restricted ONLY to Sales & Growth / Marketing / Telecaller / Counselor departments)
      const DepartmentModel = (await import('../modules/departments/department.model.js')).default;
      let salesDeptIds = [];
      if (DepartmentModel) {
        const salesDepts = await DepartmentModel.find({
          $or: [
            { name: { $regex: /sales|growth|marketing|telecaller|counsel/i } },
            { code: { $regex: /sales|growth|mkt|tc|ac/i } }
          ]
        }).select('_id');
        salesDeptIds = salesDepts.map(d => d._id);
      }

      const salesGrowthUsers = await User.find({
        $or: [
          { departmentId: { $in: salesDeptIds } },
          { department: { $regex: /sales|growth|marketing|telecaller|counsel/i } },
          { designation: { $regex: /sales|growth|marketing|telecaller|counsel/i } },
          { role: { $regex: /sales|growth|marketing|telecaller|counsel/i } }
        ]
      }).select('_id name email role designation profile_image avatar department departmentId').lean();

      const salesGrowthUserIds = salesGrowthUsers.map(u => u._id);

      const topStaffAgg = await Lead.aggregate([
        { 
          $match: { 
            status: { $regex: /^converted$/i }, 
            assignedTo: { $in: salesGrowthUserIds } 
          } 
        },
        { $group: { _id: '$assignedTo', conversions: { $sum: 1 } } },
        { $sort: { conversions: -1 } },
        { $limit: 5 }
      ]);

      let topStaff = [];
      if (topStaffAgg.length > 0) {
        topStaff = topStaffAgg.map(item => {
          const userObj = salesGrowthUsers.find(u => String(u._id) === String(item._id));
          return {
            id: item._id,
            name: userObj ? userObj.name : 'Sales & Growth Performer',
            email: userObj ? userObj.email : '',
            role: userObj ? (userObj.designation || userObj.role || 'Sales & Growth Exec') : 'Sales & Growth Exec',
            department: userObj ? (userObj.department || 'Sales & Growth') : 'Sales & Growth',
            profile_image: userObj ? (userObj.profile_image || userObj.avatar) : '',
            conversions: item.conversions
          };
        });
      } else {
        // Fallback: list top members belonging strictly to Sales & Growth department
        topStaff = salesGrowthUsers.slice(0, 5).map(u => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.designation || u.role || 'Sales & Growth Exec',
          department: u.department || 'Sales & Growth',
          profile_image: u.profile_image || u.avatar,
          conversions: 0
        }));
      }

      // 3. HR TAB METRICS
      const todayDate = getISTDate();
      const presentTodayCount = await Attendance.countDocuments({
        date: todayDate,
        status: { $regex: /^present$/i }
      });

      const attendanceRateVal = activeEmployeesCount > 0
        ? Math.min(100, ((presentTodayCount / activeEmployeesCount) * 100)).toFixed(1)
        : '100.0';

      const newlyJoinedEmployeesCount = await User.countDocuments({
        $or: [
          { joining_date: { $gte: startOfMonth } },
          { createdAt: { $gte: startOfMonth } }
        ]
      });

      // Exact Termination Count (inactive, blocked, or isActive === false)
      const terminatedQuery = {
        $or: [
          { status: 'inactive' },
          { status: 'blocked' },
          { isActive: false }
        ]
      };

      const terminatedEmployeesCount = await User.countDocuments(terminatedQuery);
      const terminatedList = await User.find(terminatedQuery)
        .select('name email designation role status joining_date profile_image avatar updatedAt')
        .sort({ updatedAt: -1 })
        .lean();

      // 4. DAILY TASK TRACKER TAB METRICS
      let tasksForMd = [];
      let tasksByMd = [];

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        tasksForMd = await Task.find({ assigned_to: userId })
          .populate('created_by', 'name email role profile_image avatar')
          .populate('assigned_to', 'name email role profile_image avatar')
          .sort({ createdAt: -1 })
          .lean();

        tasksByMd = await Task.find({ created_by: userId })
          .populate('assigned_to', 'name email role profile_image avatar')
          .populate('created_by', 'name email role profile_image avatar')
          .sort({ createdAt: -1 })
          .lean();
      }

      // Fallback: If no direct tasks found for MD ID, load company tasks for executive oversight
      if (tasksForMd.length === 0 && tasksByMd.length === 0) {
        const companyTasks = await Task.find({})
          .populate('created_by', 'name email role profile_image avatar')
          .populate('assigned_to', 'name email role profile_image avatar')
          .sort({ createdAt: -1 })
          .limit(25)
          .lean();

        tasksForMd = companyTasks;
        tasksByMd = companyTasks;
      }

      const tasksCreatedForMdCount = tasksForMd.length;
      const tasksCreatedByMdCount = tasksByMd.length;

      // Status breakdown of all MD tasks
      const allMdTasks = [...tasksForMd, ...tasksByMd];
      const statusCounts = {
        pending: allMdTasks.filter(t => t.status === 'pending').length,
        current: allMdTasks.filter(t => t.status === 'current' || t.status === 'in_progress').length,
        preview: allMdTasks.filter(t => t.status === 'preview').length,
        done: allMdTasks.filter(t => t.status === 'done' || t.status === 'completed').length
      };

      // 5. ADDITIONAL CONSOLIDATED EXECUTIVE METRICS
      let totalProjectsCount = 0;
      let activeProjectsCount = 0;
      let totalTasksCount = 0;
      let completedTasksCount = 0;
      let totalExpenses = 0;
      let totalPurchases = 0;
      let totalIncome = 0;
      let accountBalance = 0;

      try {
        if (Project) {
          totalProjectsCount = await Project.countDocuments({});
          activeProjectsCount = await Project.countDocuments({ status: { $ne: 'Completed' } });
        }
      } catch (e) {
        console.error('MD metrics Project query error:', e);
      }

      try {
        if (Task) {
          totalTasksCount = await Task.countDocuments({});
          completedTasksCount = await Task.countDocuments({ status: { $in: ['done', 'Completed', 'completed', 'Done', 'DONE'] } });
        }
      } catch (e) {
        console.error('MD metrics Task query error:', e);
      }

      try {
        if (Expense) {
          const expAgg = await Expense.aggregate([
            { $match: { isPurchase: { $ne: true }, entryType: { $ne: 'Purchase' } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);
          totalExpenses = expAgg[0]?.total || 0;

          const purAgg = await Expense.aggregate([
            { $match: { $or: [{ isPurchase: true }, { entryType: 'Purchase' }] } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);
          totalPurchases = purAgg[0]?.total || 0;
        }
      } catch (e) {
        console.error('MD metrics Expense query error:', e);
      }

      try {
        if (Income) {
          const incAgg = await Income.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$amount'] } } } }
          ]);
          totalIncome = incAgg[0]?.total || 0;
        }
      } catch (e) {
        console.error('MD metrics Income query error:', e);
      }

      try {
        if (OpeningBalance) {
          const ob = await OpeningBalance.findOne().sort({ date: -1 });
          if (ob) accountBalance = ob.balance || ob.amount || 0;
        }
      } catch (e) {
        console.error('MD metrics OpeningBalance query error:', e);
      }

      return res.status(200).json({
        success: true,
        data: {
          activeClientsCount,
          activeStudentsCount,
          newStudentsThisMonthCount,
          activeEmployeesCount,
          totalEmployeesCount,
          totalProjectsCount,
          activeProjectsCount,
          totalTasksCount,
          completedTasksCount,
          accountBalance,
          totalExpenses,
          totalIncome,
          totalPurchases,
          summary: {
            activeClients: activeClientsCount,
            activeStudents: activeStudentsCount,
            activeEmployees: activeEmployeesCount,
            totalProjects: totalProjectsCount,
            activeProjects: activeProjectsCount,
            totalTasks: totalTasksCount,
            completedTasks: completedTasksCount,
            accountBalance,
            totalExpenses,
            totalIncome,
            totalPurchases
          },
          sales: {
            totalLeads,
            convertedLeads,
            newLeads: newLeadsCount,
            contactedLeads: contactedLeadsCount,
            inProgressLeads: inProgressLeadsCount,
            lostLeads: lostLeadsCount,
            conversionRate: `${conversionRateVal}%`,
            topStaff
          },
          academy: {
            activeStudents: activeStudentsCount,
            newlyEnrolledCurrentMonth: newStudentsThisMonthCount,
            recentStudents
          },
          hr: {
            totalEmployees: totalEmployeesCount,
            attendanceRate: `${attendanceRateVal}%`,
            newlyJoinedCurrentMonth: newlyJoinedEmployeesCount,
            exactTerminationCount: terminatedEmployeesCount,
            terminatedList
          },
          dailyTaskTracker: {
            tasksCreatedForMdCount,
            tasksCreatedByMdCount,
            tasksForMd,
            tasksByMd,
            statusCounts
          }
        }
      });

    } catch (error) {
      console.error('Error in getMdMetrics controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch MD Dashboard metrics',
        error: error.message
      });
    }
  }
};
