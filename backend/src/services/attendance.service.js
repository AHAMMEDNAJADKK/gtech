import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Attendance from '../models/attendance.model.js';
import StudentAttendance from '../models/studentattendance.js';
import Enrollment from '../models/enrollment.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';

/**
 * Returns current date formatted as YYYY-MM-DD in Asia/Kolkata timezone
 */
export const getISTDate = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(dateObj);
};

/**
 * Checks if a timestamp is after 9:00 AM in Asia/Kolkata timezone
 */
export const checkIsLate = (dateObj = new Date()) => {
  try {
    const istTime = dateObj.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const [hours, minutes] = istTime.split(':').map(Number);
    return hours > 9 || (hours === 9 && minutes > 0);
  } catch {
    return false;
  }
};

/**
 * Record automatic Present attendance when an authenticated user logs in.
 * Preserves original check-in times on repeated logins and prevents duplicate records.
 */
export const recordLoginAttendance = async (user, options = {}) => {
  if (!user || !user._id) return null;

  try {
    // Only mark attendance for active accounts
    if (user.status === 'blocked' || user.status === 'inactive' || user.isActive === false) {
      return null;
    }

    const todayStr = getISTDate();
    const now = new Date();
    const userRole = String(user.role || '').toLowerCase();
    const userRoleId = String(user.role_id || '');
    const isStudent = userRole === 'student' || userRoleId === '10';

    // 1. Employee / General Daily Attendance Record
    let attRecord = await Attendance.findOne({
      user_id: user._id,
      date: todayStr
    });

    if (!attRecord) {
      // First login of the day: create attendance with current timestamp
      attRecord = await Attendance.create({
        user_id: user._id,
        date: todayStr,
        status: 'PRESENT',
        check_in_time: now,
        is_late: checkIsLate(now),
        role: userRole || (isStudent ? 'student' : 'employee')
      });
      console.log(`[ATTENDANCE] Marked initial login attendance PRESENT for user: ${user.email} (${todayStr})`);
    } else {
      // Record already exists: preserve original check_in_time and check_out_time
      let updated = false;
      if (!attRecord.check_in_time) {
        attRecord.check_in_time = now;
        attRecord.is_late = checkIsLate(now);
        updated = true;
      }
      if (attRecord.status !== 'PRESENT') {
        attRecord.status = 'PRESENT';
        updated = true;
      }
      if (updated) {
        await attRecord.save();
        console.log(`[ATTENDANCE] Preserved & ensured login attendance PRESENT for user: ${user.email} (${todayStr})`);
      }
    }

    // 2. If Student, also record daily presence in StudentAttendance for their active enrollments
    if (isStudent) {
      try {
        const activeEnrollments = await Enrollment.find({
          studentId: user._id,
          status: 'active'
        }).lean();

        for (const enr of activeEnrollments) {
          if (!enr.batchId || !enr.courseId) continue;

          const existingStudentAtt = await StudentAttendance.findOne({
            user_id: user._id,
            batchId: enr.batchId,
            courseId: enr.courseId,
            date: todayStr
          });

          if (!existingStudentAtt) {
            await StudentAttendance.create({
              user_id: user._id,
              batchId: enr.batchId,
              courseId: enr.courseId,
              date: todayStr,
              status: 'PRESENT',
              markedBy: user._id
            });
          } else if (existingStudentAtt.status === 'UNMARKED' || existingStudentAtt.status === 'ABSENT') {
            existingStudentAtt.status = 'PRESENT';
            await existingStudentAtt.save();
          }
        }
      } catch (enrollErr) {
        console.warn(`[ATTENDANCE] Warning recording student class attendance: ${enrollErr.message}`);
      }
    }

    return attRecord;
  } catch (error) {
    console.warn(`[ATTENDANCE] Error recording login attendance for user ${user?._id}:`, error.message);
    return null;
  }
};

/**
 * Build unified Daily Attendance Roster with dynamically calculated Present & Absent lists
 */
export const getDailyAttendanceRosterData = async ({
  currentUser,
  date,
  role,
  status,
  courseId,
  batchId,
  search
}) => {
  const userRole = String(currentUser.role || '').toLowerCase();
  const userRoleId = String(currentUser.role_id || '');
  const userDesig = String(currentUser.designation || '').toLowerCase();

  const isSuperAdmin = Boolean(
    currentUser.isSuperAdmin || 
    userRole === 'superadmin' || 
    userRole === 'admin' || 
    userRoleId === '0' ||
    userDesig.includes('super admin')
  );

  const isHR = Boolean(
    userRole === 'hr' || 
    (userRoleId === '2' && !isSuperAdmin) || 
    userDesig.includes('hr')
  );

  const isMentor = Boolean(
    userRole === 'mentor' || 
    userRole === 'instructor' || 
    userRoleId === '3' || 
    userDesig.includes('mentor') ||
    userDesig.includes('instructor') ||
    userDesig.includes('faculty') ||
    userDesig.includes('teacher')
  );

  const isStudent = Boolean(
    userRole === 'student' || 
    userRoleId === '10' || 
    userDesig.includes('student')
  );

  // Student Privacy Enforced: Students cannot access organization roster
  if (isStudent) {
    const error = new Error("Access denied. Attendance roster is restricted to authorized staff and mentors.");
    error.statusCode = 403;
    throw error;
  }

  if (!isSuperAdmin && !isHR && !isMentor) {
    const error = new Error("Access denied. Insufficient permissions to view daily attendance roster.");
    error.statusCode = 403;
    throw error;
  }

  const targetDate = String(date || getISTDate()).trim();
  const roleFilter = String(role || 'all').toLowerCase().trim();
  const statusFilter = String(status || 'all').toUpperCase().trim();
  const searchTerm = String(search || '').toLowerCase().trim();

  // Resolve mentor's assigned batches if mentor is querying
  let mentorBatchIds = [];
  if (isMentor && !isSuperAdmin && !isHR) {
    const assignedBatches = await Batch.find({
      $or: [
        { instructorId: currentUser._id },
        { instructors: currentUser._id }
      ]
    }).select('_id').lean();
    mentorBatchIds = assignedBatches.map(b => b._id);
  }

  // Fetch filter options (Courses and Batches)
  let courseQuery = { status: { $ne: 'INACTIVE' } };
  let batchQuery = { status: { $ne: 'INACTIVE' } };

  if (isMentor && !isSuperAdmin && !isHR) {
    batchQuery._id = { $in: mentorBatchIds };
    const batchesForMentor = await Batch.find(batchQuery).select('courseId').lean();
    const courseIds = batchesForMentor.map(b => b.courseId).filter(Boolean);
    courseQuery._id = { $in: courseIds };
  }

  const [availableCourses, availableBatches] = await Promise.all([
    Course.find(courseQuery).select('_id courseName courseCode title').lean().catch(() => []),
    Batch.find(batchQuery).select('_id batchName batchCode courseId name').lean().catch(() => [])
  ]);

  const studentRosterItems = [];
  const staffRosterItems = [];

  // A. Process Students (if role filter allows)
  if (roleFilter === 'all' || roleFilter === 'student') {
    const enrollmentQuery = {
      status: 'active'
    };

    if (isMentor && !isSuperAdmin && !isHR) {
      enrollmentQuery.batchId = { $in: mentorBatchIds };
    }

    if (batchId && batchId !== 'all' && mongoose.Types.ObjectId.isValid(String(batchId))) {
      enrollmentQuery.batchId = new mongoose.Types.ObjectId(String(batchId));
    }

    if (courseId && courseId !== 'all' && mongoose.Types.ObjectId.isValid(String(courseId))) {
      enrollmentQuery.courseId = new mongoose.Types.ObjectId(String(courseId));
    }

    const activeEnrollments = await Enrollment.find(enrollmentQuery)
      .populate({
        path: 'studentId',
        match: { status: 'active', isActive: { $ne: false } },
        select: 'name email phone studentId employeeId avatar profile_image status isActive'
      })
      .populate('batchId', 'batchName batchCode name status')
      .populate('courseId', 'courseName courseCode title')
      .lean();

    // Filter out un-enrolled, deleted, or inactive students
    const validEnrollments = activeEnrollments.filter(e => e.studentId && e.batchId && e.courseId);

    const studentUserIds = [...new Set(validEnrollments.map(e => e.studentId._id))];

    // Query student attendance records for targetDate
    const [studentAttRecords, studentLoginRecords] = await Promise.all([
      StudentAttendance.find({
        date: targetDate,
        user_id: { $in: studentUserIds }
      }).lean(),
      Attendance.find({
        date: targetDate,
        user_id: { $in: studentUserIds }
      }).lean()
    ]);

    const studentAttMap = new Map();
    studentAttRecords.forEach(att => {
      const key = `${att.user_id}_${att.batchId}_${att.courseId}`;
      studentAttMap.set(key, att);
    });

    const studentLoginMap = new Map();
    studentLoginRecords.forEach(login => {
      studentLoginMap.set(String(login.user_id), login);
    });

    for (const enr of validEnrollments) {
      const st = enr.studentId;
      const b = enr.batchId;
      const c = enr.courseId;

      const att = studentAttMap.get(`${st._id}_${b._id}_${c._id}`);
      const login = studentLoginMap.get(String(st._id));

      const isPresent = Boolean(
        (att && att.status === 'PRESENT') ||
        (login && (login.status === 'PRESENT' || login.check_in_time))
      );

      const status = isPresent 
        ? 'PRESENT' 
        : (att && att.status === 'LEAVE' ? 'LEAVE' : 'ABSENT');

      const checkInTime = login?.check_in_time || att?.createdAt || null;
      const identifier = st.studentId || st.employeeId || `STD-${String(st._id).slice(-6).toUpperCase()}`;

      studentRosterItems.push({
        id: `student_${st._id}_${b._id}`,
        userId: st._id,
        name: st.name,
        email: st.email,
        phone: st.phone || '',
        identifier,
        studentId: st.studentId || identifier,
        employeeId: null,
        role: 'student',
        roleLabel: 'Student',
        courseId: c._id,
        courseName: c.courseName || c.title || 'Course',
        courseCode: c.courseCode || '',
        batchId: b._id,
        batchName: b.batchName || b.name || 'Batch',
        batchCode: b.batchCode || '',
        department: 'Academics',
        designation: 'Enrolled Student',
        date: targetDate,
        checkInTime,
        checkOutTime: login?.check_out_time || null,
        workingHours: login?.working_hours || null,
        isLate: Boolean(login?.is_late),
        status,
        avatar: st.avatar || st.profile_image || null
      });
    }
  }

  // B. Process Employees (HR, Mentors, Staff) - only for Super Admin and HR
  if ((!isMentor || isSuperAdmin || isHR) && (roleFilter === 'all' || roleFilter === 'mentor' || roleFilter === 'hr' || roleFilter === 'employee')) {
    const staffQuery = {
      status: 'active',
      isActive: { $ne: false },
      role: { $ne: 'student' },
      role_id: { $ne: '10' }
    };

    if (roleFilter === 'hr') {
      staffQuery.$or = [
        { role: 'hr' },
        { role_id: '2' },
        { designation: /hr/i },
        { department: /human resource/i }
      ];
    } else if (roleFilter === 'mentor') {
      staffQuery.$or = [
        { role: 'mentor' },
        { role: 'instructor' },
        { role_id: '3' },
        { designation: /mentor|instructor|faculty/i }
      ];
    }

    const staffUsers = await User.find(staffQuery)
      .select('name email phone role role_id designation department employeeId avatar profile_image status isActive isSuperAdmin')
      .lean();

    const staffIds = staffUsers.map(u => u._id);
    const staffAttendanceRecords = await Attendance.find({
      date: targetDate,
      user_id: { $in: staffIds }
    }).lean();

    const staffAttMap = new Map();
    staffAttendanceRecords.forEach(att => {
      staffAttMap.set(String(att.user_id), att);
    });

    for (const emp of staffUsers) {
      const att = staffAttMap.get(String(emp._id));
      const isPresent = Boolean(att && (att.status === 'PRESENT' || att.check_in_time));
      const status = isPresent ? 'PRESENT' : 'ABSENT';

      let roleLabel = 'Employee';
      const r = (emp.role || '').toLowerCase();
      if (emp.isSuperAdmin || r === 'superadmin' || String(emp.role_id) === '0') {
        roleLabel = 'Super Admin';
      } else if (r === 'hr' || String(emp.role_id) === '2' || (emp.designation || '').toLowerCase().includes('hr')) {
        roleLabel = 'HR';
      } else if (r === 'mentor' || r === 'instructor' || String(emp.role_id) === '3' || (emp.designation || '').toLowerCase().includes('mentor')) {
        roleLabel = 'Mentor';
      }

      const identifier = emp.employeeId || `EMP-${String(emp._id).slice(-6).toUpperCase()}`;

      staffRosterItems.push({
        id: `staff_${emp._id}`,
        userId: emp._id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone || '',
        identifier,
        studentId: null,
        employeeId: emp.employeeId || identifier,
        role: emp.role || 'employee',
        roleLabel,
        department: emp.department || 'Operations',
        designation: emp.designation || roleLabel,
        courseId: null,
        courseName: null,
        batchId: null,
        batchName: null,
        date: targetDate,
        checkInTime: att?.check_in_time || null,
        checkOutTime: att?.check_out_time || null,
        workingHours: att?.working_hours || (isPresent && !att?.check_out_time ? 'Active' : '0.00'),
        isLate: Boolean(att?.is_late),
        status,
        avatar: emp.avatar || emp.profile_image || null
      });
    }
  }

  // Combine Roster Items
  const allItems = [...studentRosterItems, ...staffRosterItems];

  // Calculate Summary KPIs before status/search filters
  const totalEligible = allItems.length;
  const presentCount = allItems.filter(item => item.status === 'PRESENT').length;
  const absentCount = allItems.filter(item => item.status === 'ABSENT').length;
  const leaveCount = allItems.filter(item => item.status === 'LEAVE').length;
  const attendanceRate = totalEligible > 0 ? Math.round((presentCount / totalEligible) * 100) : 0;

  // Apply Status Filter
  let filteredItems = allItems;
  if (statusFilter === 'PRESENT') {
    filteredItems = filteredItems.filter(item => item.status === 'PRESENT');
  } else if (statusFilter === 'ABSENT') {
    filteredItems = filteredItems.filter(item => item.status === 'ABSENT');
  } else if (statusFilter === 'LEAVE') {
    filteredItems = filteredItems.filter(item => item.status === 'LEAVE');
  }

  // Apply Search Filter
  if (searchTerm) {
    filteredItems = filteredItems.filter(item => {
      const nameMatch = (item.name || '').toLowerCase().includes(searchTerm);
      const emailMatch = (item.email || '').toLowerCase().includes(searchTerm);
      const idMatch = (item.identifier || '').toLowerCase().includes(searchTerm);
      const roleMatch = (item.roleLabel || '').toLowerCase().includes(searchTerm);
      const courseMatch = (item.courseName || '').toLowerCase().includes(searchTerm);
      const batchMatch = (item.batchName || '').toLowerCase().includes(searchTerm);
      const deptMatch = (item.department || '').toLowerCase().includes(searchTerm);
      return nameMatch || emailMatch || idMatch || roleMatch || courseMatch || batchMatch || deptMatch;
    });
  }

  // Sort: Present first, then alphabetical by name
  filteredItems.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'PRESENT') return -1;
      if (b.status === 'PRESENT') return 1;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  return {
    success: true,
    date: targetDate,
    summary: {
      totalEligible,
      presentCount,
      absentCount,
      leaveCount,
      attendanceRate
    },
    filterOptions: {
      courses: availableCourses.map(c => ({
        id: c._id,
        courseName: c.courseName || c.title || 'Course',
        courseCode: c.courseCode || ''
      })),
      batches: availableBatches.map(b => ({
        id: b._id,
        batchName: b.batchName || b.name || 'Batch',
        batchCode: b.batchCode || '',
        courseId: b.courseId
      })),
      roles: ['all', 'student', 'mentor', 'hr']
    },
    records: filteredItems
  };
};

export default {
  getISTDate,
  checkIsLate,
  recordLoginAttendance,
  getDailyAttendanceRosterData
};
