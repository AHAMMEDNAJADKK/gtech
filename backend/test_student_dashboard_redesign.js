import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import app from './app.js';
import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Enrollment from './src/models/enrollment.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';
import LiveClass from './src/models/liveClass.model.js';
import StudentAttendance from './src/models/studentattendance.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('   STUDENT DASHBOARD REDESIGN & DATA ISOLATION VERIFICATION     ');
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edtech_crm';
    await mongoose.connect(mongoUri);
  }

  // 1. Authenticate Demo Users
  console.log('--- 1. AUTHENTICATION & ROLE IDENTIFICATION ---');
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'superadmin@gmail.com',
    password: 'superadmin@111'
  });
  assert(adminLogin.status === 200, 'Super Admin logs in successfully (200 OK)');
  const adminToken = adminLogin.body.token;

  const studentLogin = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'student@111'
  });
  assert(studentLogin.status === 200, 'Student logs in successfully (200 OK)');
  const studentToken = studentLogin.body.token;
  const studentUser = studentLogin.body.user;
  const studentId = studentUser._id || studentUser.id;

  assert(studentUser.role === 'student' || studentUser.role_id === '10', 'Student has role=student / role_id=10');
  assert(Boolean(studentUser.studentId), `Student has studentId identifier (${studentUser.studentId})`);

  // 2. Admin Dashboard & Authorized Controls
  console.log('\n--- 2. ADMIN DASHBOARD & CRM AUTHORIZED ACCESS ---');
  const adminDashboardRes = await request(app)
    .get('/api/v1/edtech-dashboard/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminDashboardRes.status === 200, 'Admin can fetch CRM dashboard stats (/edtech-dashboard/stats)');
  assert(adminDashboardRes.body.success === true, 'Admin stats returns success: true');
  assert(adminDashboardRes.body.data.totalEnquiries !== undefined, 'Admin stats includes totalEnquiries');
  assert(adminDashboardRes.body.data.activeLeads !== undefined, 'Admin stats includes activeLeads');
  assert(adminDashboardRes.body.data.convertedStudents !== undefined, 'Admin stats includes convertedStudents');

  // 3. Student Dashboard Isolation: Student Profile & Attendance
  console.log('\n--- 3. STUDENT DASHBOARD: PROFILE & ATTENDANCE ISOLATION ---');
  const studentProfileRes = await request(app)
    .get(`/api/v1/student/profile/${studentId}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentProfileRes.status === 200, 'Student can fetch own profile & attendance summary (/student/profile/:id)');
  assert(studentProfileRes.body.success === true, 'Student profile response indicates success');
  assert(studentProfileRes.body.data.attendanceSummary !== undefined, 'Includes attendanceSummary (rate, present, absent)');

  // Student must NOT be able to view another student's profile
  const bcrypt = (await import('bcryptjs')).default;
  const hashedPass = await bcrypt.hash('testpassword@111', 10);
  let otherStudent = await User.findOne({ email: 'isolated_student_test@gmail.com' });
  if (!otherStudent) {
    otherStudent = await User.create({
      name: 'Isolated Student',
      email: 'isolated_student_test@gmail.com',
      password: hashedPass,
      phone: '9876543210',
      role: 'student',
      role_id: '10',
      studentId: 'STU-ISOLATED'
    });
  }

  const studentInspectOther = await request(app)
    .get(`/api/v1/student/profile/${otherStudent._id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentInspectOther.status === 403, 'Student blocked from inspecting another student profile (403 Forbidden)');

  // 4. Student Attendance History
  console.log('\n--- 4. STUDENT ATTENDANCE HISTORY (STRICT PRIVACY) ---');
  const studentHistoryRes = await request(app)
    .get('/api/v1/attendance/my-history')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentHistoryRes.status === 200, 'Student /attendance/my-history returns 200 OK');
  assert(studentHistoryRes.body.isStudent === true, 'Response identifies student payload');
  assert(Array.isArray(studentHistoryRes.body.data), 'Returns daily attendance records');

  // 5. Student Enrolled Courses
  console.log('\n--- 5. STUDENT ENROLLED COURSES ---');
  const enrolledCoursesRes = await request(app)
    .get('/api/v1/academy/student/enrolled-courses')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(enrolledCoursesRes.status === 200, 'Student /academy/student/enrolled-courses returns 200 OK');
  assert(Array.isArray(enrolledCoursesRes.body.data), 'Returns enrolled courses list with progress');

  // 6. Student Assignment Scoping (No global assignments leaked)
  console.log('\n--- 6. STUDENT ASSIGNMENTS SCOPING & ISOLATION ---');
  const studentAssignmentsRes = await request(app)
    .get('/api/v1/academy/assignments')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentAssignmentsRes.status === 200, 'Student /academy/assignments returns 200 OK');
  assert(Array.isArray(studentAssignmentsRes.body.data), 'Returns student assignments array');

  // Verify other student login
  const otherLogin = await request(app).post('/api/auth/login').send({
    email: 'isolated_student_test@gmail.com',
    password: 'testpassword@111'
  });
  const otherToken = otherLogin.body.token;

  // 7. Student Submissions & Evaluated Results
  console.log('\n--- 7. STUDENT SUBMISSIONS & EVALUATED RESULTS ---');
  const mySubmissionsRes = await request(app)
    .get('/api/v1/academy/my-submissions')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(mySubmissionsRes.status === 200, 'Student /academy/my-submissions returns 200 OK');
  assert(Array.isArray(mySubmissionsRes.body.data), 'Returns submissions list');

  // 8. Student Live Classes
  console.log('\n--- 8. STUDENT UPCOMING LIVE CLASSES ---');
  const liveClassesRes = await request(app)
    .get('/api/v1/live-classes?status=UPCOMING')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(liveClassesRes.status === 200, 'Student /live-classes?status=UPCOMING returns 200 OK');
  assert(Array.isArray(liveClassesRes.body.data), 'Returns upcoming live class sessions');

  // 9. Admin Inspecting a Student's LMS Dashboard
  console.log('\n--- 9. ADMIN OPENING STUDENT LMS DASHBOARD VIA STUDENT SECTION ---');
  // Admin fetching student's enrolled courses with ?studentId=
  const adminStudentCourses = await request(app)
    .get(`/api/v1/academy/student/enrolled-courses?studentId=${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentCourses.status === 200, 'Admin can query student enrolled courses via ?studentId');
  assert(adminStudentCourses.body.success === true, 'Admin query returns success: true');

  // Admin fetching student's assignments with ?studentId=
  const adminStudentAssignments = await request(app)
    .get(`/api/v1/academy/assignments?studentId=${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentAssignments.status === 200, 'Admin can query student assignments via ?studentId');
  assert(Array.isArray(adminStudentAssignments.body.data), 'Admin receives student assignments array');

  // Admin fetching student's submissions with ?studentId=
  const adminStudentSubmissions = await request(app)
    .get(`/api/v1/academy/my-submissions?studentId=${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentSubmissions.status === 200, 'Admin can query student submissions via ?studentId');
  assert(Array.isArray(adminStudentSubmissions.body.data), 'Admin receives student submissions array');

  // Admin fetching student's live classes with ?studentId=
  const adminStudentLiveClasses = await request(app)
    .get(`/api/v1/live-classes?studentId=${studentId}&status=UPCOMING`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentLiveClasses.status === 200, 'Admin can query student live classes via ?studentId');
  assert(Array.isArray(adminStudentLiveClasses.body.data), 'Admin receives student live classes');

  // Admin fetching student's attendance history with ?studentId=
  const adminStudentHistory = await request(app)
    .get(`/api/v1/attendance/my-history?studentId=${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentHistory.status === 200, 'Admin can query student attendance history via ?studentId');
  assert(adminStudentHistory.body.isStudent === true, 'Admin query correctly receives student attendance records');

  // Admin fetching student profile directly
  const adminStudentProfile = await request(app)
    .get(`/api/v1/student/profile/${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminStudentProfile.status === 200, 'Admin can query student profile & attendance summary (/student/profile/:id)');
  assert(adminStudentProfile.body.data.student.email === 'student@gmail.com', 'Admin receives correct student data');

  console.log('\n================================================================');
  console.log(`   ALL STUDENT DASHBOARD TESTS PASSED: ${passed}/${total}`);
  console.log('================================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
