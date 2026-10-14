import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import dns from 'dns';
import app from './app.js';
import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';
import LiveClass from './src/models/liveClass.model.js';
import Task from './src/models/task.model.js';
import Department from './src/modules/departments/department.model.js';

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

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

async function runMasterAudit() {
  console.log('========================================================');
  console.log('   MASTER EDTECH CRM WORKFLOW AUDIT & QA VERIFICATION   ');
  console.log('========================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(mongoUri);
  }

  // --- SUITE 1: AUTHENTICATION FOR ALL 4 ROLES ---
  console.log('--- 1. AUTHENTICATION & CREDENTIALS VERIFICATION ---');
  
  // 1.1 Super Admin
  const adminRes = await request(app).post('/api/auth/login').send({
    email: 'superadmin@gmail.com',
    password: 'superadmin@111'
  });
  assert(adminRes.status === 200, 'Super Admin logs in with 200 OK');
  assert(adminRes.body.user.isSuperAdmin === true || adminRes.body.user.role === 'superadmin' || adminRes.body.user.role_id === '0', 'Super Admin role verified');
  const adminToken = adminRes.body.token;

  // 1.2 HR
  const hrRes = await request(app).post('/api/auth/login').send({
    email: 'hr@gmail.com',
    password: 'hr@111'
  });
  assert(hrRes.status === 200, 'HR logs in with 200 OK');
  assert(hrRes.body.user.role === 'hr' || hrRes.body.user.role_id === '2', 'HR role verified');
  const hrToken = hrRes.body.token;

  // 1.3 Mentor
  const mentorRes = await request(app).post('/api/auth/login').send({
    email: 'mentor@gmail.com',
    password: 'mentor@111'
  });
  assert(mentorRes.status === 200, 'Mentor logs in with 200 OK');
  assert(mentorRes.body.user.role === 'mentor' || mentorRes.body.user.role_id === '3', 'Mentor role verified');
  const mentorToken = mentorRes.body.token;

  // 1.4 Student
  const studentRes = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'student@111'
  });
  assert(studentRes.status === 200, 'Student logs in with 200 OK');
  assert(studentRes.body.user.role === 'student' || studentRes.body.user.role_id === '10', 'Student role verified');
  assert(Boolean(studentRes.body.user.studentId), 'Student record contains studentId identifier');
  const studentToken = studentRes.body.token;
  const studentUserId = studentRes.body.user._id || studentRes.body.user.id;

  // 1.5 Security: Bad credentials rejected
  const badAuth = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'invalid_password'
  });
  assert(badAuth.status === 401, 'Invalid password rejected with 401 Unauthorized');

  // --- SUITE 2: PROFILE RETRIEVAL & ROLE SEPARATION ---
  console.log('\n--- 2. PROFILE RETRIEVAL & DIRECTORY RBAC ---');
  
  // Student own profile fetch
  const studentProfile = await request(app)
    .get(`/api/v1/users/${studentUserId}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentProfile.status === 200, 'Student can fetch own profile (/api/v1/users/:id)');

  // Student /me
  const studentMe = await request(app)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentMe.status === 200, 'Student can fetch profile via /api/v1/users/me');

  // Student blocked from general directory
  const studentDirAccess = await request(app)
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentDirAccess.status === 403, 'Student blocked from querying all users directory (403)');

  // Mentor querying students list (/employees/students)
  const mentorStudentQuery = await request(app)
    .get('/api/v1/users?role=student&limit=50')
    .set('Authorization', `Bearer ${mentorToken}`);
  assert(mentorStudentQuery.status === 200, 'Mentor can query students directory for /employees/students (200 OK)');

  // HR querying students list
  const hrStudentQuery = await request(app)
    .get('/api/v1/users?role=student&limit=50')
    .set('Authorization', `Bearer ${hrToken}`);
  assert(hrStudentQuery.status === 200, 'HR can query students directory (200 OK)');

  // Staff list (/users/list) for lead counselor dropdowns
  const mentorStaffList = await request(app)
    .get('/api/v1/users/list')
    .set('Authorization', `Bearer ${mentorToken}`);
  assert(mentorStaffList.status === 200, 'Staff member can fetch user list (/api/v1/users/list)');

  const studentStaffList = await request(app)
    .get('/api/v1/users/list')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentStaffList.status === 403, 'Student blocked from fetching staff list (/api/v1/users/list)');

  // --- SUITE 3: COURSES & BATCHES ---
  console.log('\n--- 3. COURSES & BATCHES LIFECYCLE ---');
  const coursesRes = await request(app)
    .get('/api/v1/academy/courses')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(coursesRes.status === 200, 'Retrieve courses catalog (200 OK)');
  const courses = coursesRes.body.data || [];
  assert(courses.length > 0, 'Found existing courses in database');
  const courseId = courses[0]._id;

  const batchesRes = await request(app)
    .get(`/api/v1/academy/batches?courseId=${courseId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(batchesRes.status === 200, 'Retrieve course batches (200 OK)');
  const batches = batchesRes.body.data || [];
  const batchId = batches.length > 0 ? batches[0]._id : null;

  // --- SUITE 4: ASSIGNMENTS & ISOLATION ---
  console.log('\n--- 4. ASSIGNMENT DISTRIBUTION & TARGETED ISOLATION ---');
  // Create targeted assignment
  const targetAssignRes = await request(app)
    .post('/api/v1/academy/assignments')
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      title: 'Audit Verification Assignment',
      courseId,
      batchId,
      maxMarks: 100,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      targetType: 'STUDENTS',
      targetStudents: [studentUserId],
      isPublished: true
    });
  assert(targetAssignRes.status === 201 || targetAssignRes.status === 200, 'Mentor creates targeted assignment (200/201)');
  const assignmentId = targetAssignRes.body.data?._id || targetAssignRes.body.data?.id;

  // Student fetches assignment
  const studentAssignList = await request(app)
    .get(`/api/v1/academy/assignments?courseId=${courseId}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentAssignList.status === 200, 'Student views eligible assignments list (200 OK)');

  // Student submits assignment
  const submitRes = await request(app)
    .post(`/api/v1/academy/assignments/${assignmentId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      submissionType: 'TEXT',
      textAnswer: 'Master audit verified submission content.',
      fileUrl: ''
    });
  assert(submitRes.status === 201 || submitRes.status === 200, 'Student successfully submits assignment');

  // Mentor grades assignment
  const subRecord = await AssignmentSubmission.findOne({ assignmentId, studentId: studentUserId });
  assert(Boolean(subRecord), 'Submission record persisted in AssignmentSubmission collection');

  const gradeRes = await request(app)
    .patch(`/api/v1/academy/submissions/${subRecord._id}/grade`)
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      grade: 95,
      feedback: 'Excellent work verified by audit test.'
    });
  assert(gradeRes.status === 200, 'Mentor grades submission with score 95 (200 OK)');

  // Student checks results
  const mySubmissionsRes = await request(app)
    .get('/api/v1/academy/my-submissions')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(mySubmissionsRes.status === 200, 'Student fetches /academy/my-submissions (200 OK)');
  const gradedItem = (mySubmissionsRes.body.data || []).find(s => String(s.assignmentId?._id || s.assignmentId) === String(assignmentId));
  assert(Boolean(gradedItem), 'Student can view graded result');
  assert(gradedItem.grade === 95, 'Grade matches awarded 95 marks');

  // --- SUITE 5: LIVE CLASSROOMS ---
  console.log('\n--- 5. LIVE CLASSROOMS LIFECYCLE ---');
  const liveClassRes = await request(app)
    .post('/api/v1/live-classes')
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      title: 'Full Stack Masterclass',
      description: 'System audit live session',
      courseId,
      batchId: batchId || new mongoose.Types.ObjectId(),
      platform: 'Google Meet',
      meetingUrl: 'https://meet.google.com/xyz-audt-abc',
      scheduledDate: new Date().toISOString().split('T')[0],
      startTime: '11:00 AM'
    });
  assert(liveClassRes.status === 201, 'Mentor schedules Live Class (201 Created)');
  const liveClassId = liveClassRes.body.data?._id;

  const getLiveClasses = await request(app)
    .get('/api/v1/live-classes')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(getLiveClasses.status === 200, 'Admin can list scheduled live classes');

  // --- SUITE 6: ATTENDANCE SYSTEM & DAILY ROSTER ---
  console.log('\n--- 6. ATTENDANCE ENGINE & DAILY ROSTER ---');
  // Student shift endpoints
  const myShiftRes = await request(app)
    .get('/api/v1/attendance/my-shift')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(myShiftRes.status === 200, 'Student fetches /attendance/my-shift (200 OK)');

  const myHistoryRes = await request(app)
    .get('/api/v1/attendance/my-history')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(myHistoryRes.status === 200, 'Student fetches /attendance/my-history (200 OK)');

  // HR Daily Attendance Roster
  const rosterRes = await request(app)
    .get('/api/v1/attendance/roster')
    .set('Authorization', `Bearer ${hrToken}`);
  assert(rosterRes.status === 200, 'HR fetches /attendance/roster (200 OK)');
  assert(Boolean(rosterRes.body.summary), 'Roster includes summary KPI metrics');
  assert(Array.isArray(rosterRes.body.records), 'Roster includes verified records array');

  // Security: Student forbidden from roster
  const studentRosterRes = await request(app)
    .get('/api/v1/attendance/roster')
    .set('Authorization', `Bearer ${studentToken}`);
  assert(studentRosterRes.status === 403, 'Student strictly forbidden from accessing /attendance/roster (403)');

  // --- SUITE 7: TASK REMINDERS, DEPARTMENTS & SHIFT REPORTS ---
  console.log('\n--- 7. TASKS, DEPARTMENTS & DAILY SHIFT REPORTS ---');
  
  // Tasks endpoint
  const tasksRes = await request(app)
    .get('/api/v1/tasks/all')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(tasksRes.status === 200, 'GET /api/v1/tasks/all returns 200 OK (no 404)');

  // Departments endpoint
  const deptRes = await request(app)
    .get('/api/v1/departments?status=true')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deptRes.status === 200, 'GET /api/v1/departments?status=true returns 200 OK (no 404)');

  // Daily Shift Reports
  const shiftReportRes = await request(app)
    .get(`/api/v1/daily-shift-reports/by-date?dateString=2026-10-14&userId=${studentUserId}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert(shiftReportRes.status === 200, 'GET /api/v1/daily-shift-reports/by-date returns 200 OK (no 404)');

  const saveShiftReport = await request(app)
    .post('/api/v1/daily-shift-reports')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      userId: studentUserId,
      dateString: '2026-10-14',
      basicDetails: { employeeName: 'Student Candidate', department: 'Operations' },
      dailyOperations: [{ activity: 'Learned Fullstack modules', status: 'Completed' }]
    });
  assert(saveShiftReport.status === 200, 'POST /api/v1/daily-shift-reports saves report (200 OK)');

  // Clean up test created live class and assignment
  if (liveClassId) await LiveClass.findByIdAndDelete(liveClassId);
  if (assignmentId) {
    await Assignment.findByIdAndDelete(assignmentId);
    await AssignmentSubmission.deleteMany({ assignmentId });
  }

  console.log('\n========================================================');
  console.log(`   MASTER AUDIT COMPLETED: ${passed}/${total} PASSED (0 FAILED)`);
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runMasterAudit().catch(err => {
  console.error('Master audit execution error:', err);
  process.exit(1);
});
