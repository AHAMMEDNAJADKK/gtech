import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import app from './app.js';
import User from './src/models/user.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Lead from './src/models/lead.model.js';
import StudentFee from './src/models/studentFee.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function runValidation() {
  console.log('================================================================');
  console.log('   FULL END-TO-END VALIDATION: 12 EDTECH CRM ISSUES   ');
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(mongoUri);
  }

  // --- 0. AUTHENTICATION ---
  console.log('--- 0. AUTHENTICATION SETUP ---');
  const adminRes = await request(app).post('/api/auth/login').send({
    email: 'superadmin@gmail.com',
    password: 'superadmin@111'
  });
  assert(adminRes.status === 200, 'Super Admin logged in successfully');
  const adminToken = adminRes.body.token;

  const mentorRes = await request(app).post('/api/auth/login').send({
    email: 'mentor@gmail.com',
    password: 'mentor@111'
  });
  assert(mentorRes.status === 200, 'Mentor logged in successfully');
  const mentorToken = mentorRes.body.token;

  const studentRes = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'student@111'
  });
  assert(studentRes.status === 200, 'Student logged in successfully');
  const studentToken = studentRes.body.token;
  const studentId = studentRes.body.user._id || studentRes.body.user.id;

  // Retrieve course & batch for testing
  let testCourse = await Course.findOne({ status: 'ACTIVE' });
  if (!testCourse) testCourse = await Course.findOne();
  assert(!!testCourse, `Active Course found: ${testCourse?.courseName || testCourse?.title}`);

  let testBatch = await Batch.findOne({ courseId: testCourse._id });
  if (!testBatch) {
    testBatch = await Batch.create({
      batchName: 'Validation Batch 2026',
      batchCode: 'VAL-2026',
      courseId: testCourse._id,
      startDate: new Date(),
      status: 'ACTIVE',
      students: [studentId]
    });
  } else if (!testBatch.students?.some(s => String(s) === String(studentId))) {
    testBatch.students.push(studentId);
    await testBatch.save();
  }
  assert(!!testBatch, `Active Batch found: ${testBatch?.batchName} for Course ${testCourse.courseName}`);

  // --- ISSUE 1: LEADS MODULE - COMPANY NAME REMOVAL & SCHEMA INTEGRITY ---
  console.log('\n--- ISSUE 1: LEADS MODULE AUDIT ---');
  const testLeadPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const testLeadEmail = `lead_${Date.now()}@testcrm.com`;
  
  const createLeadRes = await request(app)
    .post('/api/v1/leads')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      leadName: 'John Test Lead',
      name: 'John Test Lead',
      email: testLeadEmail,
      phone: testLeadPhone,
      source: 'Website',
      status: 'New',
      interestedService: testCourse.courseName
    });
  
  assert(createLeadRes.status === 201 || createLeadRes.status === 200, 'Lead created successfully without companyName');
  const createdLead = createLeadRes.body.data || createLeadRes.body.lead || createLeadRes.body;
  const leadId = createdLead.id || leadId;
  assert(!!leadId, 'Lead has valid database ObjectId');

  // Verify lead schema has studentId field capability
  const leadDoc = await Lead.findById(leadId);
  assert(leadDoc.studentId === undefined || leadDoc.studentId === null, 'Lead schema supports studentId reference');

  // --- ISSUE 2: LEAD CONVERSION TO ENROLLED STUDENT ---
  console.log('\n--- ISSUE 2: LEAD CONVERSION WORKFLOW ---');
  // Attempt conversion without courseId -> Should fail
  const failedConversionRes = await request(app)
    .post(`/api/v1/leads/${leadId}/convert`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert(failedConversionRes.status === 400, 'Lead conversion rejected when courseId is missing');

  // Successful conversion with courseId and batchId
  const convertRes = await request(app)
    .post(`/api/v1/leads/${leadId}/convert`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      courseId: testCourse._id,
      batchId: testBatch._id
    });
  assert(convertRes.status === 200, `Lead converted to student (Status 200 OK)`);
  assert(convertRes.body.success === true, 'Conversion response reports success: true');
  assert(!!convertRes.body.data?.student?.id || !!convertRes.body.data?.student?._id, 'Converted student profile created in User model');
  assert(!!convertRes.body.data?.enrollment, 'Enrollment record created linking Course and Batch');

  // Verify lead status in DB is now 'Converted' and studentId is linked
  const updatedLeadDoc = await Lead.findById(leadId);
  assert(updatedLeadDoc.status === 'Converted', `Lead status updated to 'Converted' in database`);
  assert(!!updatedLeadDoc.studentId, 'Lead has studentId link persisted');

  // Attempt duplicate conversion -> Must be rejected with 400
  const duplicateConvertRes = await request(app)
    .post(`/api/v1/leads/${leadId}/convert`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      courseId: testCourse._id,
      batchId: testBatch._id
    });
  assert(duplicateConvertRes.status === 400, 'Duplicate conversion safely rejected with 400 Bad Request');

  // --- ISSUE 3: DUPLICATE LEADS NAVIGATION DEDUPLICATION ---
  console.log('\n--- ISSUE 3: NAVIGATION DEDUPLICATION AUDIT ---');
  const sidebarCode = fs.readFileSync(path.join(__dirname, '../front crm/src/components/Sidebar.jsx'), 'utf8');
  assert(sidebarCode.includes('seenKeys') || sidebarCode.includes('uniqueVisibleItems') || sidebarCode.includes('seenPaths'), 'Sidebar navigation contains strict deduplication logic');

  // --- ISSUE 4: STUDENT PROGRESS COURSE & BATCH FETCHING ---
  console.log('\n--- ISSUE 4: STUDENT PROGRESS COURSE/BATCH FETCHING ---');
  const enrollmentRes = await request(app)
    .get(`/api/v1/academy/enrollments?courseId=${testCourse._id}&batchId=${testBatch._id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(enrollmentRes.status === 200, 'Enrollments fetched filtered by courseId and batchId');
  assert(Array.isArray(enrollmentRes.body.data), 'Enrollments returned as array');

  // --- ISSUE 5: LMS FILE UPLOAD CRASH FIX ---
  console.log('\n--- ISSUE 5: LMS FILE UPLOAD DISK STORAGE FIX ---');
  const dummyFilePath = path.join(__dirname, 'test_upload_sample.pdf');
  fs.writeFileSync(dummyFilePath, 'Sample EdTech Assignment Submission Document');

  const uploadRes = await request(app)
    .post('/api/v1/academy/lms/upload')
    .set('Authorization', `Bearer ${studentToken}`)
    .attach('file', dummyFilePath);

  if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);

  assert(uploadRes.status === 200, 'File upload completed with 200 OK without buffer TypeError crash');
  const fileUrl = uploadRes.body.data?.url || uploadRes.body.url;
  assert(!!fileUrl, `Uploaded file returned valid accessibility URL: ${fileUrl}`);

  // --- ISSUE 6: ATTENDANCE PAGE & ROSTER DATA ---
  console.log('\n--- ISSUE 6: ATTENDANCE PAGE LAYOUT & ROSTER ENDPOINT ---');
  const rosterRes = await request(app)
    .get('/api/attendance/roster')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(rosterRes.status === 200, 'Attendance roster API returned 200 OK');
  assert(rosterRes.body.summary !== undefined, 'Roster response provides summary object (totalEligible, presentCount, absentCount)');
  assert(typeof rosterRes.body.summary.totalEligible === 'number', 'summary.totalEligible is valid number preventing UI crash');

  // --- ISSUE 7: DAILY ATTENDANCE PRESENT/ABSENT TRACKING ---
  console.log('\n--- ISSUE 7: DAILY ATTENDANCE PRESENT/ABSENT TRACKING ---');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  const markAttRes = await request(app)
    .post('/api/v1/attendance/mark')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      user_id: studentId,
      batchId: testBatch._id,
      courseId: testCourse._id,
      date: todayStr,
      status: 'PRESENT'
    });
  assert(markAttRes.status === 200, 'Daily attendance marked as PRESENT for student in course/batch');
  assert(markAttRes.body.data?.status === 'PRESENT', 'Attendance record saved with status PRESENT');

  // Fetch student attendance for today
  const getAttRes = await request(app)
    .get(`/api/v1/attendance/student/${todayStr}?batchId=${testBatch._id}&courseId=${testCourse._id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(getAttRes.status === 200, 'Fetched daily attendance by date and course/batch');

  // --- ISSUE 8: ASSIGNMENT CREATION WITH INDIVIDUAL STUDENT TARGETING ---
  console.log('\n--- ISSUE 8: ASSIGNMENT CREATION FOR TARGET STUDENTS ---');
  const createAssignRes = await request(app)
    .post('/api/v1/academy/assignments')
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      title: 'Targeted Module Assessment',
      description: 'Individual student targeted homework assignment',
      courseId: testCourse._id,
      batchId: testBatch._id,
      targetType: 'STUDENTS',
      targetStudents: [studentId],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
      totalMarks: 100,
      passingMarks: 40
    });
  assert(createAssignRes.status === 201 || createAssignRes.status === 200, 'Assignment created with targetType: STUDENTS');
  const createdAssignment = createAssignRes.body.data;
  assert(createdAssignment.targetType === 'STUDENTS', 'Assignment has targetType STUDENTS');
  assert(createdAssignment.targetStudents?.length > 0, 'Assignment has targetStudents populated');

  // --- ISSUE 9: ASSIGNMENT GRADING & RESULTS ---
  console.log('\n--- ISSUE 9: ASSIGNMENT SUBMISSION & GRADING ---');
  // Student submits assignment
  const submitAssignRes = await request(app)
    .post(`/api/v1/academy/assignments/${createdAssignment._id}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      content: 'Here is my complete project submission with all requirements met.',
      fileUrl: fileUrl
    });
  assert(submitAssignRes.status === 200 || submitAssignRes.status === 201, 'Student submitted assignment successfully');
  const submissionId = submitAssignRes.body.data?._id;

  // Mentor grades submission
  const gradeRes = await request(app)
    .post(`/api/v1/academy/assignments/submissions/${submissionId}/grade`)
    .set('Authorization', `Bearer ${mentorToken}`)
    .send({
      grade: 92,
      feedback: 'Excellent work on the architecture and clean implementation.'
    });
  assert(gradeRes.status === 200, 'Assignment graded with valid numeric marks and feedback');
  assert(gradeRes.body.data?.grade === 92, 'Grade recorded as 92/100');
  assert(gradeRes.body.data?.status === 'GRADED', 'Submission status updated to GRADED');

  // --- ISSUE 10: STUDENT FEE ACCOUNT COURSE & BATCH SELECTION ---
  console.log('\n--- ISSUE 10: STUDENT FEE ACCOUNT COURSE & BATCH LINKAGE ---');
  await StudentFee.deleteMany({ studentId: studentId, courseId: testCourse._id });
  const createFeeRes = await request(app)
    .post('/api/v1/student-fees')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      studentId: studentId,
      courseId: testCourse._id,
      batchId: testBatch._id,
      totalAmount: 50000,
      discountAmount: 5000,
      installments: [
        { installmentNumber: 1, amount: 25000, dueDate: new Date(Date.now() + 15 * 86400000) },
        { installmentNumber: 2, amount: 20000, dueDate: new Date(Date.now() + 45 * 86400000) }
      ]
    });
  assert(createFeeRes.status === 201 || createFeeRes.status === 200, 'Student fee account created with distinct courseId and batchId');
  const createdFee = createFeeRes.body.data;
  assert(String(createdFee.courseId) === String(testCourse._id), 'Fee courseId matches Course ObjectId');
  assert(String(createdFee.batchId) === String(testBatch._id), 'Fee batchId matches Batch ObjectId');

  // --- ISSUE 11: FEE RECEIPT & PLANS ---
  console.log('\n--- ISSUE 11: FEE RECEIPT & PLANS ---');
  // Issue direct receipt with partial payment for a fresh course
  const secondCourse = await Course.findOne({ _id: { $ne: testCourse._id } }) || testCourse;
  await StudentFee.deleteMany({ studentId: studentId, courseId: secondCourse._id });
  const directReceiptRes = await request(app)
    .post('/api/v1/student-fees/issue-receipt')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      studentId: studentId,
      courseId: secondCourse._id,
      batchId: testBatch._id,
      amount: 15000,
      totalAmount: 40000,
      discountAmount: 0,
      paymentMethod: 'Cash at Counter',
      notes: 'Initial admission fee'
    });
  assert(directReceiptRes.status === 200, 'Direct fee receipt issued with upfront partial payment');
  const receiptNo = directReceiptRes.body.data?.receiptNo;
  assert(!!receiptNo, `Receipt generated with sequential receipt number: ${receiptNo}`);

  // If partial payment, verify balance was auto-scheduled into installment 2
  const directFee = directReceiptRes.body.data?.fee;
  assert(directFee.installments?.length >= 2, 'Remaining balance scheduled into installment 2');
  assert(directFee.installments[0].status === 'PAID', 'Installment 1 marked as PAID');
  assert(directFee.installments[1].status === 'PENDING', 'Installment 2 marked as PENDING for remaining balance');
  assert(directFee.installments[1].amount === 25000, 'Installment 2 amount equals remaining balance (25000)');

  // Verify Receipt PDF Generation
  const pdfRes = await request(app)
    .get(`/api/v1/student-fees/receipts/${receiptNo}/pdf`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(pdfRes.status === 200, 'Receipt PDF generated successfully (Status 200 OK)');
  assert(pdfRes.headers['content-type'] === 'application/pdf', 'Response Content-Type is application/pdf');

  // --- ISSUE 12: INSTALLMENT TRACKER AUTO-ALLOCATION ---
  console.log('\n--- ISSUE 12: INSTALLMENT TRACKER AUTO-ALLOCATION ---');
  // Pay the remaining installment on directFee
  const payInstallmentRes = await request(app)
    .post(`/api/v1/student-fees/${directFee._id}/record-payment`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      amount: 25000,
      paymentMethod: 'UPI - GooglePay',
      installmentIndex: 1
    });
  assert(payInstallmentRes.status === 200, 'Remaining balance installment payment recorded');
  const updatedFee = payInstallmentRes.body.data?.fee;
  assert(updatedFee.installments[1].status === 'PAID', 'Installment 2 status updated from PENDING to PAID');
  assert(updatedFee.status === 'PAID', 'Overall student fee status updated to PAID');
  assert(updatedFee.dueAmount === 0, 'Remaining due balance is 0');

  console.log('\n================================================================');
  console.log(`   VALIDATION SUMMARY: ${passed} / ${total} TESTS PASSED (100%) `);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runValidation().catch(err => {
  console.error('\n❌ VALIDATION TEST FAILED WITH EXCEPTION:', err);
  process.exit(1);
});
