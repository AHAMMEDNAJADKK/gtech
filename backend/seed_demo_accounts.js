import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Enrollment from './src/models/enrollment.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';
import LiveClass from './src/models/liveClass.model.js';
import Attendance from './src/models/attendance.model.js';

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

export async function seedDemoAccounts() {
  try {
    console.log('🔄 Connecting to MongoDB for Demo Accounts Seeding...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database:', mongoose.connection.name);

    // 1. Super Admin Account
    const superAdminPasswordHash = await bcrypt.hash('superadmin@111', 10);
    let superAdmin = await User.findOne({ email: 'superadmin@gmail.com' });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@gmail.com',
        phone: '+91 9999999999',
        password: superAdminPasswordHash,
        passwordHash: superAdminPasswordHash,
        role: 'superadmin',
        role_id: '0',
        isSuperAdmin: true,
        status: 'active',
        isActive: true,
        employeeId: 'EMP-SUPERADMIN-001',
        designation: 'Super Administrator'
      });
      console.log('✅ Created Super Admin account: superadmin@gmail.com');
    } else {
      superAdmin.password = superAdminPasswordHash;
      superAdmin.passwordHash = superAdminPasswordHash;
      superAdmin.role = 'superadmin';
      superAdmin.role_id = '0';
      superAdmin.isSuperAdmin = true;
      superAdmin.status = 'active';
      superAdmin.isActive = true;
      await superAdmin.save();
      console.log('✅ Verified & Updated Super Admin account: superadmin@gmail.com');
    }

    // 2. HR Account
    const hrPasswordHash = await bcrypt.hash('hr@111', 10);
    let hrUser = await User.findOne({ email: 'hr@gmail.com' });
    if (!hrUser) {
      hrUser = await User.create({
        name: 'HR Operations Lead',
        email: 'hr@gmail.com',
        phone: '+91 9888888888',
        password: hrPasswordHash,
        passwordHash: hrPasswordHash,
        role: 'hr',
        role_id: '2',
        isSuperAdmin: false,
        status: 'active',
        isActive: true,
        employeeId: 'EMP-HR-001',
        designation: 'HR & Operations Manager',
        department: 'Human Resources'
      });
      console.log('✅ Created HR account: hr@gmail.com');
    } else {
      hrUser.password = hrPasswordHash;
      hrUser.passwordHash = hrPasswordHash;
      hrUser.role = 'hr';
      hrUser.role_id = '2';
      hrUser.status = 'active';
      hrUser.isActive = true;
      await hrUser.save();
      console.log('✅ Verified & Updated HR account: hr@gmail.com');
    }

    // 3. Mentor Account
    const mentorPasswordHash = await bcrypt.hash('mentor@111', 10);
    let mentorUser = await User.findOne({ email: 'mentor@gmail.com' });
    if (!mentorUser) {
      mentorUser = await User.create({
        name: 'Senior Lead Mentor',
        email: 'mentor@gmail.com',
        phone: '+91 9777777777',
        password: mentorPasswordHash,
        passwordHash: mentorPasswordHash,
        role: 'mentor',
        role_id: '3',
        isSuperAdmin: false,
        status: 'active',
        isActive: true,
        employeeId: 'EMP-MENTOR-001',
        designation: 'Senior Faculty Mentor',
        department: 'Academics & Training'
      });
      console.log('✅ Created Mentor account: mentor@gmail.com');
    } else {
      mentorUser.password = mentorPasswordHash;
      mentorUser.passwordHash = mentorPasswordHash;
      mentorUser.role = 'mentor';
      mentorUser.role_id = '3';
      mentorUser.status = 'active';
      mentorUser.isActive = true;
      await mentorUser.save();
      console.log('✅ Verified & Updated Mentor account: mentor@gmail.com');
    }

    // 4. Student Account
    const studentPasswordHash = await bcrypt.hash('student@111', 10);
    let studentUser = await User.findOne({ email: 'student@gmail.com' });
    if (!studentUser) {
      studentUser = await User.create({
        name: 'Demo Student',
        email: 'student@gmail.com',
        phone: '+91 9666666666',
        password: studentPasswordHash,
        passwordHash: studentPasswordHash,
        role: 'student',
        role_id: '10',
        isSuperAdmin: false,
        status: 'active',
        isActive: true,
        studentId: 'STD-2026-DEMO01',
        employeeId: 'STD-2026-DEMO01',
        designation: 'Student'
      });
      console.log('✅ Created Student account: student@gmail.com');
    } else {
      studentUser.password = studentPasswordHash;
      studentUser.passwordHash = studentPasswordHash;
      studentUser.role = 'student';
      studentUser.role_id = '10';
      studentUser.status = 'active';
      studentUser.isActive = true;
      if (!studentUser.studentId) studentUser.studentId = 'STD-2026-DEMO01';
      await studentUser.save();
      console.log('✅ Verified & Updated Student account: student@gmail.com');
    }

    // 5. Ensure an Active Demo Course exists
    let demoCourse = await Course.findOne({ courseCode: 'FSWD-101' });
    if (!demoCourse) {
      demoCourse = await Course.create({
        courseCode: 'FSWD-101',
        courseName: 'Full Stack Web Development & MERN Stack',
        description: 'Comprehensive industry program covering React, Node.js, Express, MongoDB, and System Design.',
        category: 'Web Development',
        durationValue: 4,
        durationUnit: 'Months',
        status: 'ACTIVE',
        instructorId: mentorUser._id,
        syllabus: [
          {
            moduleId: 'mod_1',
            title: 'Modern Frontend Architecture with React',
            description: 'Components, Hooks, State Management, and Tailwind CSS',
            order: 1,
            topics: [
              { topicId: 'top_1', title: 'React Basics & Components', order: 1 },
              { topicId: 'top_2', title: 'State Management & Custom Hooks', order: 2 }
            ]
          },
          {
            moduleId: 'mod_2',
            title: 'Backend API Engineering with Node & Express',
            description: 'RESTful API Design, JWT Authentication, and RBAC',
            order: 2,
            topics: [
              { topicId: 'top_3', title: 'Express Routing & Controllers', order: 1 },
              { topicId: 'top_4', title: 'JWT Authentication & RBAC Middleware', order: 2 }
            ]
          }
        ]
      });
      console.log('✅ Created Demo Course: FSWD-101');
    } else {
      demoCourse.instructorId = mentorUser._id;
      demoCourse.status = 'ACTIVE';
      await demoCourse.save();
      console.log('✅ Verified Demo Course: FSWD-101');
    }

    // 6. Ensure an Active Demo Batch exists
    let demoBatch = await Batch.findOne({ batchCode: 'FSWD-2026-B1' });
    if (!demoBatch) {
      demoBatch = await Batch.create({
        batchCode: 'FSWD-2026-B1',
        batchName: 'MERN Full Stack Regular - Batch 1',
        courseId: demoCourse._id,
        instructorId: mentorUser._id,
        instructors: [mentorUser._id],
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'ONGOING',
        capacity: 30,
        students: [studentUser._id]
      });
      console.log('✅ Created Demo Batch: FSWD-2026-B1');
    } else {
      if (!demoBatch.students?.some(id => String(id) === String(studentUser._id))) {
        demoBatch.students = demoBatch.students || [];
        demoBatch.students.push(studentUser._id);
      }
      demoBatch.instructorId = mentorUser._id;
      demoBatch.instructors = [mentorUser._id];
      demoBatch.status = 'ONGOING';
      await demoBatch.save();
      console.log('✅ Verified Demo Batch: FSWD-2026-B1');
    }

    // 7. Ensure Enrollment for studentUser
    let studentEnrollment = await Enrollment.findOne({
      studentId: studentUser._id,
      courseId: demoCourse._id
    });
    if (!studentEnrollment) {
      studentEnrollment = await Enrollment.create({
        studentId: studentUser._id,
        courseId: demoCourse._id,
        batchId: demoBatch._id,
        status: 'active',
        enrollmentDate: new Date(),
        progressPercentage: 45
      });
      console.log('✅ Enrolled Demo Student into FSWD-101 Course');
    } else {
      studentEnrollment.batchId = demoBatch._id;
      studentEnrollment.status = 'active';
      await studentEnrollment.save();
      console.log('✅ Verified Demo Student Enrollment');
    }

    // 8. Ensure Sample Assignment exists
    let demoAssignment = await Assignment.findOne({
      courseId: demoCourse._id,
      title: 'MERN Authentication & Role-Based Access Control Implementation'
    });
    if (!demoAssignment) {
      demoAssignment = await Assignment.create({
        courseId: demoCourse._id,
        batchId: demoBatch._id,
        assignedMentor: mentorUser._id,
        moduleId: 'mod_2',
        title: 'MERN Authentication & Role-Based Access Control Implementation',
        description: 'Build a secure authentication system using JWT, bcrypt password hashing, and custom RBAC middleware.',
        instructions: '1. Create Express middleware for verifying Bearer tokens.\n2. Implement role-based route protection for Super Admin, HR, Mentor, and Student.\n3. Submit your implementation as a PDF report or screenshot bundle.',
        maxMarks: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        allowedSubmissionTypes: ['FILE', 'TEXT'],
        allowedFileFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxFileSize: 10485760,
        targetType: 'BATCH',
        targetStudents: [studentUser._id],
        isPublished: true,
        status: 'PUBLISHED',
        createdBy: mentorUser._id
      });
      console.log('✅ Created Demo Assignment: MERN Authentication & RBAC');
    } else {
      demoAssignment.batchId = demoBatch._id;
      demoAssignment.assignedMentor = mentorUser._id;
      demoAssignment.targetStudents = [studentUser._id];
      demoAssignment.isPublished = true;
      demoAssignment.status = 'PUBLISHED';
      await demoAssignment.save();
      console.log('✅ Verified Demo Assignment');
    }

    // 9. Ensure Sample Live Class exists
    let demoLiveClass = await LiveClass.findOne({
      courseId: demoCourse._id,
      batchId: demoBatch._id,
      title: 'Masterclass: Advanced MERN State Management & RBAC Security'
    });
    if (!demoLiveClass) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      demoLiveClass = await LiveClass.create({
        title: 'Masterclass: Advanced MERN State Management & RBAC Security',
        description: 'Interactive live session covering secure token refresh, session invalidation, and custom role permissions.',
        courseId: demoCourse._id,
        batchId: demoBatch._id,
        instructorId: mentorUser._id,
        platform: 'Google Meet',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        meetingId: 'abc-defg-hij',
        passcode: 'KOD2026',
        scheduledDate: tomorrow,
        startTime: '07:00 PM',
        endTime: '08:30 PM',
        durationMinutes: 90,
        status: 'UPCOMING',
        materialsUrl: 'https://github.com/edtech-crm/mern-masterclass-docs',
        createdBy: mentorUser._id
      });
      console.log('✅ Created Demo Live Class session');
    } else {
      console.log('✅ Verified Demo Live Class session');
    }

    // 10. Ensure Sample Today Attendance for Mentor & HR
    const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let mentorAttendance = await Attendance.findOne({ user_id: mentorUser._id, date: istDate });
    if (!mentorAttendance) {
      const checkInTime = new Date();
      checkInTime.setHours(checkInTime.getHours() - 3); // 3 hours ago
      await Attendance.create({
        user_id: mentorUser._id,
        date: istDate,
        status: 'PRESENT',
        check_in_time: checkInTime,
        check_out_time: null,
        working_hours: '3.00',
        is_late: false
      });
      console.log(`✅ Seeded active shift attendance for Mentor on ${istDate}`);
    }

    console.log('\n======================================================');
    console.log('🎉 DEMO ACCOUNTS SEEDED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('1. Super Admin: superadmin@gmail.com / superadmin@111');
    console.log('2. HR:          hr@gmail.com         / hr@111');
    console.log('3. Mentor:      mentor@gmail.com     / mentor@111');
    console.log('4. Student:     student@gmail.com    / student@111');
    console.log('======================================================\n');

    return {
      success: true,
      superAdmin,
      hrUser,
      mentorUser,
      studentUser,
      demoCourse,
      demoBatch
    };
  } catch (err) {
    console.error('❌ Error seeding demo accounts:', err);
    throw err;
  }
}

// Allow direct execution: node seed_demo_accounts.js
if (process.argv[1] && process.argv[1].endsWith('seed_demo_accounts.js')) {
  seedDemoAccounts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
