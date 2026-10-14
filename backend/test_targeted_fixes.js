import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import app from './app.js';
import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';
import Task from './src/models/task.model.js';
import AcademicCounselorReport from './src/models/academicCounselorReport.model.js';
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
  console.log('========================================================');
  console.log('   EDTECH CRM: TARGETED BUG FIXES VERIFICATION SUITE');
  console.log('========================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edtech_crm';
    await mongoose.connect(mongoUri);
  }

  // 1. Authenticate Demo Users
  console.log('--- 1. AUTHENTICATION OF TEST ROLES ---');
  const studentLogin = await request(app).post('/api/auth/login').send({ email: 'student@gmail.com', password: 'student@111' });
  assert(studentLogin.status === 200, 'Student logs in successfully');
  const studentToken = studentLogin.body.token;
  const studentUser = studentLogin.body.user;

  const hrLogin = await request(app).post('/api/auth/login').send({ email: 'hr@gmail.com', password: 'hr@111' });
  assert(hrLogin.status === 200, 'HR logs in successfully');
  const hrToken = hrLogin.body.token;

  const mentorLogin = await request(app).post('/api/auth/login').send({ email: 'mentor@gmail.com', password: 'mentor@111' });
  assert(mentorLogin.status === 200, 'Mentor logs in successfully');
  const mentorToken = mentorLogin.body.token;

  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'superadmin@gmail.com', password: 'superadmin@111' });
  assert(adminLogin.status === 200, 'Super Admin logs in successfully');
  const adminToken = adminLogin.body.token;

  // 2. Attendance & Student Isolation Fixes
  console.log('\n--- 2. ATTENDANCE PAGE & STUDENT SHIFT ACCESS FIXES ---');
  // Student trying to check in to employee shift -> must be 403
  const studentCheckIn = await request(app)
    .post('/api/v1/attendance/check-in')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentCheckIn.status === 403, 'Student is strictly forbidden from checking into employee shift (403)');

  // Student trying to check out of employee shift -> must be 403
  const studentCheckOut = await request(app)
    .post('/api/v1/attendance/check-out')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentCheckOut.status === 403, 'Student is strictly forbidden from checking out of employee shift (403)');

  // Student fetching my-shift: must return 200 with safe object (not crash)
  const studentMyShift = await request(app)
    .get('/api/v1/attendance/my-shift')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentMyShift.status === 200, 'Student /attendance/my-shift returns 200 OK');
  assert(studentMyShift.body.success === true, 'Returns success: true flag');
  assert(studentMyShift.body.isStudent === true, 'Identifies student correctly');
  assert(studentMyShift.body.attendance === null, 'Attendance safely set to null without crash');

  // Student fetching attendance summary: forbidden (403)
  const studentSummary = await request(app)
    .get('/api/v1/attendance/summary')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentSummary.status === 403, 'Student is forbidden from viewing organization attendance summary (403)');

  // HR fetching attendance summary: allowed (200)
  const hrSummary = await request(app)
    .get('/api/v1/attendance/summary')
    .set('Authorization', `Bearer ${hrToken}`);
  assert(hrSummary.status === 200, 'HR can access attendance summary (200)');
  assert(Array.isArray(hrSummary.body.records), 'HR receives organization records array');

  // Student fetching my-history: returns class attendance
  const studentHistory = await request(app)
    .get('/api/v1/attendance/my-history')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentHistory.status === 200, 'Student /attendance/my-history returns 200 OK');
  assert(Array.isArray(studentHistory.body.data), 'History returns an array');
  assert(studentHistory.body.isStudent === true, 'Identifies student history payload');

  // 3. Task API Fix
  console.log('\n--- 3. TASK DUE REMINDER MODAL API (/api/v1/tasks/all) ---');
  const taskRes = await request(app)
    .get('/api/v1/tasks/all')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(taskRes.status === 200, 'GET /api/v1/tasks/all returns 200 OK (no longer 404)');
  assert(taskRes.body.success === true, 'Returns success: true');
  assert(Array.isArray(taskRes.body.data), 'Returns tasks array');

  // 4. Department API Fix
  console.log('\n--- 4. DEPARTMENT API (/api/v1/departments?status=true) ---');
  const deptRes = await request(app)
    .get('/api/v1/departments?status=true')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deptRes.status === 200, 'GET /api/v1/departments?status=true returns 200 OK (no longer 404)');
  assert(Array.isArray(deptRes.body) || Array.isArray(deptRes.body.data), 'Returns departments list');

  // 5. Daily Shift Report API Fixes
  console.log('\n--- 5. DAILY SHIFT REPORT API (/api/v1/daily-shift-reports) ---');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const reportByDate = await request(app)
    .get(`/api/v1/daily-shift-reports/by-date?dateString=${todayStr}&userId=${studentUser.id || studentUser._id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(reportByDate.status === 200, 'GET /daily-shift-reports/by-date returns 200 OK (no longer 404)');
  assert(reportByDate.body.success === true, 'Returns success: true flag');

  // Test saving report
  const saveReportRes = await request(app)
    .post('/api/v1/daily-shift-reports')
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      dateString: todayStr,
      basicDetails: {
        employeeName: 'Mentor Test',
        designation: 'Faculty Mentor',
        department: 'Academics'
      },
      dailyOperations: [
        { activity: 'Live Classroom Session', status: 'Completed' }
      ]
    });
  assert(saveReportRes.status === 200, 'POST /daily-shift-reports saves successfully (200 OK)');
  assert(saveReportRes.body.success === true, 'Saved report returns success: true');

  // 6. Assignment Creation with Individual Student Target
  console.log('\n--- 6. INDIVIDUAL STUDENT ASSIGNMENT CREATION & ISOLATION ---');
  const course = await Course.findOne().lean();
  assert(Boolean(course), 'Found test course for assignment testing');

  // Create second student for isolation testing
  let otherStudent = await User.findOne({ email: 'isolated_student_test@gmail.com' });
  const bcrypt = (await import('bcryptjs')).default;
  const hashedPass = await bcrypt.hash('testpassword@111', 10);
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
  } else {
    otherStudent.password = hashedPass;
    await otherStudent.save();
  }

  // Create assignment targeted ONLY to primary student
  const studentObjId = studentUser.id || studentUser._id;
  const createAssignRes = await request(app)
    .post(`/api/v1/academy/courses/${course._id}/assignments`)
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      title: 'Individual Targeted Assignment Test',
      description: 'Testing individual student targeting',
      instructions: 'Submit your solution',
      maxMarks: 100,
      targetType: 'STUDENTS',
      targetStudents: [studentObjId]
    });

  assert(createAssignRes.status === 201, 'Assignment created with targetType=STUDENTS (201 Created)');
  const createdAssignment = createAssignRes.body.data;
  assert(createdAssignment.targetType === 'STUDENTS', 'Assignment model persisted targetType=STUDENTS');
  assert(createdAssignment.targetStudents.length === 1, 'Assignment has 1 target student');

  // Verify that an initial NOT_STARTED submission was created for targeted student
  const initialSub = await AssignmentSubmission.findOne({
    assignmentId: createdAssignment._id,
    studentId: studentObjId
  });
  assert(Boolean(initialSub), 'Initial submission record generated for targeted student');
  assert(initialSub.status === 'NOT_STARTED', 'Initial submission status is NOT_STARTED');

  // Verify that NO initial submission exists for the non-targeted student
  const otherSub = await AssignmentSubmission.findOne({
    assignmentId: createdAssignment._id,
    studentId: otherStudent._id
  });
  assert(!otherSub, 'No submission record generated for non-targeted student');

  // Login other student and verify they CANNOT see the assignment
  const otherLogin = await request(app).post('/api/auth/login').send({ email: 'isolated_student_test@gmail.com', password: 'testpassword@111' });
  const otherToken = otherLogin.body.token;

  const otherAssignmentsList = await request(app)
    .get(`/api/v1/academy/assignments?courseId=${course._id}`)
    .set('Authorization', `Bearer ${otherToken}`);
  assert(otherAssignmentsList.status === 200, 'Other student can list course assignments');
  const foundInOther = (otherAssignmentsList.body.data || []).some(a => String(a._id) === String(createdAssignment._id));
  assert(!foundInOther, 'Targeted assignment is hidden from non-targeted student');

  // Targeted student CAN see the assignment
  const studentAssignmentsList = await request(app)
    .get(`/api/v1/academy/assignments?courseId=${course._id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  const foundInTargeted = (studentAssignmentsList.body.data || []).some(a => String(a._id) === String(createdAssignment._id));
  assert(foundInTargeted, 'Targeted assignment is visible to the assigned student');

  // Non-targeted student cannot submit to this assignment (403)
  const otherSubmit = await request(app)
    .post(`/api/v1/academy/assignments/${createdAssignment._id}/submit`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ submissionType: 'TEXT', textAnswer: 'Unauthorized attempt' });
  assert(otherSubmit.status === 403, 'Non-targeted student is blocked from submitting (403)');

  // Clean up test assignment
  await Assignment.findByIdAndDelete(createdAssignment._id);
  await AssignmentSubmission.deleteMany({ assignmentId: createdAssignment._id });

  console.log('\n========================================================');
  console.log(`  ALL TARGETED BUG FIXES PASSED: ${passed}/${total}`);
  console.log('========================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
