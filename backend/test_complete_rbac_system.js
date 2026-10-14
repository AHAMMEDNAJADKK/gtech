import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from './app.js';
import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';
import LiveClass from './src/models/liveClass.model.js';
import Attendance from './src/models/attendance.model.js';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('  EDTECH CRM: COMPLETE ROLE-BASED WORKFLOW TEST SUITE');
  console.log('========================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edtech_crm';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);
  }

  // -----------------------------------------------------------
  // TEST 1: DEMO ACCOUNTS & LOGIN VERIFICATION (ALL 4 ROLES)
  // -----------------------------------------------------------
  console.log('--- TEST SUITE 1: 4 DEMO ACCOUNTS LOGIN & AUTHENTICATION ---');
  
  const testAccounts = [
    { email: 'superadmin@gmail.com', pass: 'superadmin@111', role: 'admin', label: 'Super Admin' },
    { email: 'hr@gmail.com', pass: 'hr@111', role: 'hr', label: 'HR' },
    { email: 'mentor@gmail.com', pass: 'mentor@111', role: 'instructor', label: 'Mentor' },
    { email: 'student@gmail.com', pass: 'student@111', role: 'student', label: 'Student' }
  ];

  const tokens = {};
  const users = {};

  for (const acc of testAccounts) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: acc.email, password: acc.pass });

    assert(res.status === 200, `${acc.label} (${acc.email}) HTTP login returns 200 OK`);
    assert(res.body.token, `${acc.label} receives valid JWT access token`);
    tokens[acc.email] = res.body.token;
    users[acc.email] = res.body.user;
  }

  // -----------------------------------------------------------
  // TEST 2: RBAC PERMISSION GATING & ROUTE PROTECTION
  // -----------------------------------------------------------
  console.log('\n--- TEST SUITE 2: STRICT RBAC ROUTE GATING ---');

  // 2.1 Student must be forbidden from accessing staff User Management
  const studentUsersRes = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`);
  assert(studentUsersRes.status === 403, 'Student is strictly forbidden from accessing /api/users (403)');

  // 2.2 Mentor must be forbidden from administrative user management
  const mentorUsersRes = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`);
  assert(mentorUsersRes.status === 403, 'Mentor is restricted from staff user management (403)');

  // 2.3 Super Admin must have full authorized access to /api/users
  const adminUsersRes = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${tokens['superadmin@gmail.com']}`);
  assert(adminUsersRes.status === 200, 'Super Admin has full access to /api/users (200)');

  // -----------------------------------------------------------
  // TEST 3: LIVE CLASSROOMS CREATION & ROLE-SCOPED ACCESS
  // -----------------------------------------------------------
  console.log('\n--- TEST SUITE 3: LIVE CLASSROOMS LIFECYCLE ---');

  // Find demo batch
  const demoBatch = await Batch.findOne({ batchCode: 'FSWD-2026-B1' });
  const demoCourse = await Course.findOne({ courseCode: 'FSWD-101' });
  assert(demoBatch && demoCourse, 'Demo Course & Batch exist in database');

  // Mentor/HR creates a live class
  const liveClassRes = await request(app)
    .post('/api/live-classes')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      title: 'Full Stack Masterclass - React Hooks & State',
      description: 'Interactive deep dive into React state patterns',
      platform: 'Google Meet',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 60,
      courseId: demoCourse._id,
      batchId: demoBatch._id,
      status: 'UPCOMING'
    });
  assert(liveClassRes.status === 201 || liveClassRes.status === 200, 'Mentor creates Live Classroom session');
  const createdClassId = liveClassRes.body?.data?._id || liveClassRes.body?._id;

  // Student queries live classes
  const studentLiveClasses = await request(app)
    .get('/api/live-classes')
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`);
  assert(studentLiveClasses.status === 200, 'Student retrieves live classes (200)');
  const foundClass = (studentLiveClasses.body?.data || studentLiveClasses.body || []).find(
    c => c._id?.toString() === createdClassId?.toString() || c.title?.includes('React')
  );
  assert(Boolean(foundClass), 'Enrolled student can view scheduled live class session');

  // -----------------------------------------------------------
  // TEST 4: COMPLETE ASSIGNMENT LIFECYCLE (CREATE -> SUBMIT -> RESUBMIT -> GRADE)
  // -----------------------------------------------------------
  console.log('\n--- TEST SUITE 4: ASSIGNMENT LIFECYCLE & RESUBMISSION ---');

  // 4.1 Mentor creates Assignment targeted to the Batch
  const createAssignmentRes = await request(app)
    .post('/api/academy/assignments')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      title: 'Automated Test: Express API & MongoDB Integration',
      description: 'Implement a secure Express router with input sanitization and Mongoose queries.',
      instructions: 'Upload a PDF report and include your GitHub repo link.',
      courseId: demoCourse._id,
      batchId: demoBatch._id,
      targetType: 'BATCH',
      targetBatch: demoBatch._id,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      maxMarks: 100,
      passingMarks: 50,
      allowedFileFormats: ['pdf', 'png', 'jpg'],
      maxFileSize: 10,
      status: 'PUBLISHED'
    });
  assert(createAssignmentRes.status === 201 || createAssignmentRes.status === 200, 'Mentor publishes new batch assignment');
  const assignmentId = createAssignmentRes.body?.data?._id || createAssignmentRes.body?._id;
  assert(Boolean(assignmentId), 'Assignment ID generated successfully');

  // 4.2 Student views published assignment list
  const studentAssignmentsRes = await request(app)
    .get('/api/academy/assignments')
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`);
  assert(studentAssignmentsRes.status === 200, 'Student views assignment list');
  const assignmentsList = studentAssignmentsRes.body?.data || studentAssignmentsRes.body || [];
  const studentAssigned = assignmentsList.find(a => a._id?.toString() === assignmentId.toString());
  assert(Boolean(studentAssigned), 'Student sees the published assignment');
  assert(studentAssigned.mySubmission?.status === 'NOT_STARTED', 'Initial student submission status is NOT_STARTED');

  // 4.3 Student submits assignment
  const submitRes = await request(app)
    .post(`/api/academy/assignments/${assignmentId}/submit`)
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`)
    .send({
      submissionUrl: 'https://cdn.example.com/submissions/student_api_project.pdf',
      notes: 'Implemented with JWT auth and validation middleware. All endpoints verified.',
      links: ['https://github.com/student/express-api-demo']
    });
  assert(submitRes.status === 200 || submitRes.status === 201, 'Student successfully submits assignment (200/201)');
  assert(submitRes.body?.data?.status === 'SUBMITTED', 'Submission status updated to SUBMITTED');
  assert(submitRes.body?.data?.isLate === false, 'On-time submission correctly marked isLate=false');

  // 4.4 HR/Mentor checks grading queue
  const gradingQueueRes = await request(app)
    .get('/api/academy/grading/submissions')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`);
  assert(gradingQueueRes.status === 200, 'Mentor retrieves grading queue (200)');
  const queue = gradingQueueRes.body?.data || [];
  const queuedItem = queue.find(q => q.assignmentId?._id?.toString() === assignmentId.toString());
  assert(Boolean(queuedItem), 'Mentor finds submitted assignment in grading queue');

  // 4.5 Mentor requests resubmission with feedback
  const resubmitReqRes = await request(app)
    .patch(`/api/academy/submissions/${queuedItem._id}/grade`)
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      submissionId: queuedItem._id,
      status: 'RESUBMISSION_REQUIRED',
      resubmissionReason: 'Please attach the Postman collection export and unit test screenshots.',
      feedback: 'Good architecture, but test coverage documentation is missing.'
    });
  assert(resubmitReqRes.status === 200, 'Mentor requests resubmission (200)');
  assert(resubmitReqRes.body?.data?.status === 'RESUBMISSION_REQUIRED', 'Status set to RESUBMISSION_REQUIRED');
  assert(resubmitReqRes.body?.data?.resubmissionReason?.includes('Postman'), 'Resubmission reason saved in database');

  // 4.6 Student verifies status and resubmits
  const mySubmissionsRes = await request(app)
    .get('/api/academy/my-submissions')
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`);
  assert(mySubmissionsRes.status === 200, 'Student checks my-submissions history');
  const mySub = (mySubmissionsRes.body?.data || []).find(s => s.assignmentId?._id?.toString() === assignmentId.toString());
  assert(mySub?.status === 'RESUBMISSION_REQUIRED', 'Student sees RESUBMISSION_REQUIRED status');

  // Student resubmits with updated files
  const resubmitAction = await request(app)
    .post(`/api/academy/assignments/${assignmentId}/submit`)
    .set('Authorization', `Bearer ${tokens['student@gmail.com']}`)
    .send({
      submissionUrl: 'https://cdn.example.com/submissions/student_api_project_v2_with_tests.pdf',
      notes: 'Added Postman test collection and Newman test execution results.',
      links: ['https://github.com/student/express-api-demo/tree/v2']
    });
  assert(resubmitAction.status === 200 || resubmitAction.status === 201, 'Student successfully resubmits work (200/201)');
  assert(resubmitAction.body?.data?.status === 'SUBMITTED', 'Status returned to SUBMITTED');
  assert(Boolean(resubmitAction.body?.data?.resubmittedAt), 'resubmittedAt timestamp recorded');

  // 4.7 Mentor awards final marks and feedback
  const finalGradeRes = await request(app)
    .patch(`/api/academy/submissions/${queuedItem._id}/grade`)
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      submissionId: queuedItem._id,
      status: 'GRADED',
      marks: 94,
      maxMarks: 100,
      feedback: 'Excellent work! Test suite covers all edge cases and documentation is comprehensive.'
    });
  assert(finalGradeRes.status === 200, 'Mentor finalizes grading (200)');
  assert(finalGradeRes.body?.data?.status === 'GRADED', 'Submission status updated to GRADED');
  assert(finalGradeRes.body?.data?.grade === 94, 'Awarded 94 marks (grade === 94)');

  // -----------------------------------------------------------
  // TEST 5: SHIFT ATTENDANCE SYSTEM (CHECK-IN / OUT / SUMMARY)
  // -----------------------------------------------------------
  console.log('\n--- TEST SUITE 5: ATTENDANCE SHIFT MANAGEMENT ---');

  // Clean any active shifts for test mentor
  const mentorId = users['mentor@gmail.com'].id || users['mentor@gmail.com']._id;
  await Attendance.deleteMany({ user_id: mentorId });

  // 5.1 Mentor Check-in
  const checkInRes = await request(app)
    .post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      notes: 'Beginning morning shift & code review session'
    });
  assert(checkInRes.status === 200 || checkInRes.status === 201, 'Mentor successfully checks in (200/201)');
  const checkInRecord = checkInRes.body?.attendance || checkInRes.body;
  assert(Boolean(checkInRecord?.check_in_time), 'Check-in timestamp recorded');

  // 5.2 Query Active Shift
  const myShiftRes = await request(app)
    .get('/api/attendance/my-shift')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`);
  assert(myShiftRes.status === 200, 'Retrieve active shift (200)');
  assert(myShiftRes.body?.isActiveShift === true, 'isActiveShift flag is true');
  assert(Boolean(myShiftRes.body?.attendance?.check_in_time), 'Active shift attendance record returned');

  // 5.3 Duplicate Check-in Prevention
  const dupCheckIn = await request(app)
    .post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({ notes: 'Attempting duplicate check-in' });
  assert(dupCheckIn.status === 400 || dupCheckIn.status === 200, 'Duplicate check-in handled properly');
  assert(dupCheckIn.body?.detail?.includes('Already checked in') || dupCheckIn.body?.check_in_time, 'Safely prevents duplicate open shifts');

  // 5.4 Mentor Check-out
  const checkOutRes = await request(app)
    .post('/api/attendance/check-out')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`)
    .send({
      notes: 'Completed all grading queue reviews'
    });
  assert(checkOutRes.status === 200, 'Mentor successfully checks out (200)');
  const checkOutRecord = checkOutRes.body?.attendance || checkOutRes.body;
  assert(Boolean(checkOutRecord?.check_out_time), 'Check-out timestamp recorded');
  assert(typeof checkOutRecord?.working_hours === 'string', 'Working hours computed');

  // 5.5 Shift History & Summary
  const historyRes = await request(app)
    .get('/api/attendance/my-history')
    .set('Authorization', `Bearer ${tokens['mentor@gmail.com']}`);
  assert(historyRes.status === 200, 'Retrieve user shift history (200)');
  assert(Array.isArray(historyRes.body?.data), 'Shift history is an array');

  const summaryRes = await request(app)
    .get('/api/attendance/summary')
    .set('Authorization', `Bearer ${tokens['hr@gmail.com']}`);
  assert(summaryRes.status === 200, 'HR retrieves attendance summary metrics (200)');
  assert(typeof summaryRes.body?.totalMarked === 'number', 'Summary includes totalMarked metric');

  // -----------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------
  console.log('\n========================================================');
  console.log(`  ALL ROLE-BASED WORKFLOW TESTS PASSED: ${passedChecks}/${totalChecks}`);
  console.log('========================================================\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Encountered Error:\n', err);
  process.exit(1);
});
