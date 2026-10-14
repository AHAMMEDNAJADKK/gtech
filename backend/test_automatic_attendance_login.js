import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

import User from './src/models/user.model.js';
import Attendance from './src/models/attendance.model.js';
import StudentAttendance from './src/models/studentattendance.js';
import Enrollment from './src/models/enrollment.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import { getISTDate } from './src/services/attendance.service.js';

const BASE_URL = 'http://localhost:5000/api/v1';
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

let serverProcess = null;

async function runTests() {
  console.log('========================================================');
  console.log('   AUTOMATIC LOGIN ATTENDANCE & ROSTER VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Connect to DB
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB:', mongoose.connection.name);

  // Setup Express server instance if not running externally
  const { default: app } = await import('./app.js');
  const server = app.listen(5009);
  const API = axios.create({
    baseURL: 'http://localhost:5009/api/v1',
    validateStatus: () => true
  });

  const todayStr = getISTDate();
  console.log(`Testing with IST Date: ${todayStr}\n`);

  try {
    // -------------------------------------------------------------
    // 1. Prepare Fresh Clean State for Today's Attendance
    // -------------------------------------------------------------
    console.log('--- 1. CLEANING TODAY ATTENDANCE FOR DETERMINISTIC TEST ---');
    await Attendance.deleteMany({ date: todayStr });
    await StudentAttendance.deleteMany({ date: todayStr });
    console.log('Cleared existing attendance for today.\n');

    // Find our demo users
    const student = await User.findOne({ email: 'student@gmail.com' });
    const mentor = await User.findOne({ email: 'mentor@gmail.com' });
    const hr = await User.findOne({ email: 'hr@gmail.com' });
    const superAdmin = await User.findOne({ email: 'superadmin@gmail.com' });

    assert(student && mentor && hr && superAdmin, 'All 4 demo user accounts exist in DB');

    // Create a dummy inactive student and an un-enrolled student to verify they are excluded from roster
    const dummyInactiveStudent = await User.findOneAndUpdate(
      { email: 'inactive_student_test@gmail.com' },
      {
        name: 'Inactive Test Student',
        email: 'inactive_student_test@gmail.com',
        phone: '+91 9999000001',
        role: 'student',
        role_id: '10',
        status: 'inactive',
        isActive: false
      },
      { upsert: true, new: true }
    );

    const dummyUnenrolledStudent = await User.findOneAndUpdate(
      { email: 'unenrolled_student_test@gmail.com' },
      {
        name: 'Unenrolled Test Student',
        email: 'unenrolled_student_test@gmail.com',
        phone: '+91 9999000002',
        role: 'student',
        role_id: '10',
        status: 'active',
        isActive: true
      },
      { upsert: true, new: true }
    );
    // Ensure unenrolled student has no enrollments
    await Enrollment.deleteMany({ studentId: dummyUnenrolledStudent._id });

    // -------------------------------------------------------------
    // 2. Pre-Login Verification: Everyone is Initially ABSENT
    // -------------------------------------------------------------
    console.log('\n--- 2. PRE-LOGIN ROSTER CHECK (ABSENT INTEGRITY) ---');
    // Login as SuperAdmin to inspect roster before anyone else logs in
    const adminLoginRes = await API.post('/auth/login', {
      email: 'superadmin@gmail.com',
      password: 'superadmin@111'
    });
    assert(adminLoginRes.status === 200, 'Super Admin logs in successfully');
    const adminToken = adminLoginRes.data.token;

    // Fetch initial roster for today
    const initialRosterRes = await API.get('/attendance/roster', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(initialRosterRes.status === 200, 'Super Admin can fetch /attendance/roster');
    const initialData = initialRosterRes.data;

    assert(initialData.summary && typeof initialData.summary.totalEligible === 'number', 'Summary object contains totalEligible');
    assert(initialData.summary.presentCount >= 1, 'Super Admin who just logged in is marked PRESENT');
    
    // Check that Student (who has NOT logged in yet) is calculated as ABSENT
    const studentInInitialRoster = initialData.records.find(r => String(r.userId) === String(student._id));
    assert(studentInInitialRoster !== undefined, 'Enrolled student is present in eligible roster');
    assert(studentInInitialRoster?.status === 'ABSENT', 'Student who has not logged in is dynamically marked ABSENT');
    assert(studentInInitialRoster?.checkInTime === null, 'Absent student has null check-in time');

    // Verify un-enrolled and inactive students are excluded
    const inactiveFound = initialData.records.some(r => String(r.userId) === String(dummyInactiveStudent._id));
    assert(!inactiveFound, 'Inactive student is excluded from eligible roster');
    const unenrolledFound = initialData.records.some(r => String(r.userId) === String(dummyUnenrolledStudent._id));
    assert(!unenrolledFound, 'Un-enrolled student is excluded from student roster');

    // -------------------------------------------------------------
    // 3. Automatic Student Login Attendance
    // -------------------------------------------------------------
    console.log('\n--- 3. AUTOMATIC STUDENT LOGIN ATTENDANCE ---');
    const studentLoginRes = await API.post('/auth/login', {
      email: 'student@gmail.com',
      password: 'student@111'
    });
    assert(studentLoginRes.status === 200, 'Student logs in successfully');
    const studentToken = studentLoginRes.data.token;

    // Check Attendance collection for student
    const studentAttDoc = await Attendance.findOne({ user_id: student._id, date: todayStr });
    assert(studentAttDoc !== null, 'Attendance record created for student in Attendance collection');
    assert(studentAttDoc?.status === 'PRESENT', 'Student status marked PRESENT on login');
    assert(studentAttDoc?.check_in_time instanceof Date, 'Student check_in_time recorded as server timestamp');
    const firstStudentCheckInTime = studentAttDoc?.check_in_time.getTime();

    // Check StudentAttendance collection for student active enrollments
    const studentCourseAttDocs = await StudentAttendance.find({ user_id: student._id, date: todayStr });
    assert(studentCourseAttDocs.length > 0, 'StudentAttendance records created for active batch enrollments');
    assert(studentCourseAttDocs[0]?.status === 'PRESENT', 'StudentAttendance record status is PRESENT');

    // -------------------------------------------------------------
    // 4. Repeated Student Login (Preserve Check-in Time & No Duplicates)
    // -------------------------------------------------------------
    console.log('\n--- 4. REPEATED STUDENT LOGIN INTEGRITY ---');
    // Wait 100ms
    await new Promise(r => setTimeout(r, 100));

    const studentSecondLoginRes = await API.post('/auth/login', {
      email: 'student@gmail.com',
      password: 'student@111'
    });
    assert(studentSecondLoginRes.status === 200, 'Student second login succeeded');

    const totalStudentAttDocs = await Attendance.countDocuments({ user_id: student._id, date: todayStr });
    assert(totalStudentAttDocs === 1, 'Exactly ONE attendance record exists (no duplicate records)');

    const reloadedStudentAttDoc = await Attendance.findOne({ user_id: student._id, date: todayStr });
    assert(
      reloadedStudentAttDoc.check_in_time.getTime() === firstStudentCheckInTime,
      'Original check_in_time was preserved and NOT reset on second login'
    );

    // -------------------------------------------------------------
    // 5. Automatic HR & Mentor Login Attendance
    // -------------------------------------------------------------
    console.log('\n--- 5. AUTOMATIC HR & MENTOR LOGIN ATTENDANCE ---');
    const hrLoginRes = await API.post('/auth/login', {
      email: 'hr@gmail.com',
      password: 'hr@111'
    });
    assert(hrLoginRes.status === 200, 'HR logs in successfully');
    const hrToken = hrLoginRes.data.token;

    const hrAttDoc = await Attendance.findOne({ user_id: hr._id, date: todayStr });
    assert(hrAttDoc !== null && hrAttDoc.status === 'PRESENT', 'HR marked PRESENT in Attendance on login');
    assert(hrAttDoc.check_in_time instanceof Date, 'HR check_in_time recorded');

    const mentorLoginRes = await API.post('/auth/login', {
      email: 'mentor@gmail.com',
      password: 'mentor@111'
    });
    assert(mentorLoginRes.status === 200, 'Mentor logs in successfully');
    const mentorToken = mentorLoginRes.data.token;

    const mentorAttDoc = await Attendance.findOne({ user_id: mentor._id, date: todayStr });
    assert(mentorAttDoc !== null && mentorAttDoc.status === 'PRESENT', 'Mentor marked PRESENT in Attendance on login');
    assert(mentorAttDoc.check_in_time instanceof Date, 'Mentor check_in_time recorded');

    // -------------------------------------------------------------
    // 6. Present / Absent Daily Roster API for HR & Super Admin
    // -------------------------------------------------------------
    console.log('\n--- 6. DAILY ROSTER API FOR HR & SUPER ADMIN ---');
    const hrRosterRes = await API.get('/attendance/roster', {
      headers: { Authorization: `Bearer ${hrToken}` }
    });
    assert(hrRosterRes.status === 200, 'HR can fetch /attendance/roster');
    const hrRosterData = hrRosterRes.data;

    assert(hrRosterData.summary.presentCount >= 3, 'Present count reflects student, hr, mentor, superadmin');
    
    // Check fields in student record
    const studentRosterItem = hrRosterData.records.find(r => String(r.userId) === String(student._id));
    assert(studentRosterItem !== undefined, 'Student found in HR roster');
    assert(studentRosterItem.status === 'PRESENT', 'Student now shows as PRESENT in roster');
    assert(studentRosterItem.studentId !== null, 'Student ID displayed in roster record');
    assert(studentRosterItem.courseName !== null, 'Course name displayed for student');
    assert(studentRosterItem.batchName !== null, 'Batch name displayed for student');
    assert(studentRosterItem.checkInTime !== null, 'Check-in time displayed for student');

    // Check fields in employee record
    const mentorRosterItem = hrRosterData.records.find(r => String(r.userId) === String(mentor._id));
    assert(mentorRosterItem !== undefined, 'Mentor found in HR roster');
    assert(mentorRosterItem.roleLabel === 'Mentor', 'Mentor role correctly labeled');
    assert(mentorRosterItem.employeeId !== null, 'Employee ID displayed for mentor');

    // -------------------------------------------------------------
    // 7. Filters: Role, Status, Course, Batch, and Search
    // -------------------------------------------------------------
    console.log('\n--- 7. ROSTER FILTERING & SEARCH INTEGRITY ---');
    // Filter by role=student
    const studentOnlyRoster = await API.get('/attendance/roster?role=student', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(studentOnlyRoster.status === 200, 'Filter role=student returns 200');
    assert(
      studentOnlyRoster.data.records.every(r => r.role === 'student'),
      'All records in role=student query have role=student'
    );

    // Filter by role=mentor
    const mentorOnlyRoster = await API.get('/attendance/roster?role=mentor', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(mentorOnlyRoster.status === 200, 'Filter role=mentor returns 200');
    assert(
      mentorOnlyRoster.data.records.every(r => r.role === 'mentor' || r.roleLabel === 'Mentor'),
      'All records in role=mentor query are mentors'
    );

    // Filter by status=PRESENT
    const presentOnlyRoster = await API.get('/attendance/roster?status=PRESENT', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(presentOnlyRoster.status === 200, 'Filter status=PRESENT returns 200');
    assert(
      presentOnlyRoster.data.records.every(r => r.status === 'PRESENT'),
      'All records in status=PRESENT query have status=PRESENT'
    );

    // Filter by search query
    const searchByName = await API.get(`/attendance/roster?search=${encodeURIComponent(student.name.slice(0, 4))}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchByName.status === 200, 'Search by name returns 200');
    assert(
      searchByName.data.records.some(r => String(r.userId) === String(student._id)),
      'Searched student is returned in results'
    );

    // -------------------------------------------------------------
    // 8. Student Attendance Privacy Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 8. PRIVACY & RBAC ENFORCEMENT ---');
    // Student attempting to fetch organization roster
    const studentRosterAttempt = await API.get('/attendance/roster', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(studentRosterAttempt.status === 403, 'Student is strictly FORBIDDEN from accessing /attendance/roster (403)');

    // Student attempting to fetch organization summary
    const studentSummaryAttempt = await API.get('/attendance/summary', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(studentSummaryAttempt.status === 403, 'Student is strictly FORBIDDEN from accessing /attendance/summary (403)');

    // Mentor fetching roster: allowed, but scoped
    const mentorRosterRes = await API.get('/attendance/roster', {
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    assert(mentorRosterRes.status === 200, 'Mentor can fetch roster within assigned scope (200)');
    // Mentor should NOT see HR or SuperAdmin in their roster
    const hrInMentorRoster = mentorRosterRes.data.records.some(r => r.role === 'hr' || r.role === 'superadmin');
    assert(!hrInMentorRoster, 'Mentor roster does NOT contain HR or SuperAdmin staff');

    // -------------------------------------------------------------
    // 9. Clean up temporary test accounts
    // -------------------------------------------------------------
    await User.deleteMany({ email: { $in: ['inactive_student_test@gmail.com', 'unenrolled_student_test@gmail.com'] } });
    console.log('\nCleaned up dummy test users.');

  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n========================================================');
  console.log(`  AUTOMATIC ATTENDANCE VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
