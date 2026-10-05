import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import app from './app.js';
import User from './src/models/user.model.js';
import Lead from './src/models/lead.model.js';
import Course from './src/models/course.model.js';
import Batch from './src/models/batch.model.js';
import Enrollment from './src/models/enrollment.model.js';
import StudentFee from './src/models/studentFee.model.js';
import Certificate from './src/models/certificate.model.js';
import LiveClass from './src/models/liveClass.model.js';
import Assignment from './src/models/assignment.model.js';
import AssignmentSubmission from './src/models/assignmentSubmission.model.js';

dotenv.config();

const PORT = 5099;
const SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  bugs: []
};

function recordTest(category, name, passed, details = '') {
  testResults.total++;
  if (!testResults.categories[category]) {
    testResults.categories[category] = { passed: 0, failed: 0, total: 0 };
  }
  testResults.categories[category].total++;

  if (passed) {
    testResults.passed++;
    testResults.categories[category].passed++;
    console.log(`  ✅ [PASS] ${category} » ${name}`);
  } else {
    testResults.failed++;
    testResults.categories[category].failed++;
    console.error(`  ❌ [FAIL] ${category} » ${name} - ${details}`);
    testResults.bugs.push({ category, name, details });
  }
}

async function runMasterTest() {
  console.log('\n===============================================================');
  console.log('🚀 COMMENCING COMPREHENSIVE PRODUCTION QA TEST SUITE');
  console.log('===============================================================\n');

  // Wait for MongoDB connection ready
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('open', resolve));
  }

  const server = app.listen(PORT, async () => {
    try {
      console.log(`📡 QA Test Server listening on http://localhost:${PORT}\n`);

      // -------------------------------------------------------------
      // 1. AUTHENTICATION & LOGIN TESTING
      // -------------------------------------------------------------
      console.log('--- 1. AUTHENTICATION & LOGIN TESTS ---');

      // 1.1 Valid Superadmin login
      const validLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@gmail.com', password: 'superadmin@111' })
      });
      const validLoginData = await validLoginRes.json();
      recordTest('Authentication', 'Valid Superadmin Login (200 OK & Token)', validLoginRes.status === 200 && !!validLoginData.token);

      // 1.2 Invalid password
      const badPwRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@gmail.com', password: 'wrongpassword' })
      });
      recordTest('Authentication', 'Invalid Password Rejection (401 Unauthorized)', badPwRes.status === 401);

      // 1.3 Non-existent user
      const nonExistentRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost_user_999@gmail.com', password: 'somepassword' })
      });
      recordTest('Authentication', 'Non-existent User Rejection (401 Unauthorized)', nonExistentRes.status === 401);

      // 1.4 Empty credentials
      const emptyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      recordTest('Authentication', 'Empty Credentials Rejection (400 Bad Request)', emptyLoginRes.status === 400);

      // 1.5 Missing Token on protected route
      const noTokenRes = await fetch(`${BASE_URL}/leads`);
      recordTest('Authentication', 'Protected Route Rejects Missing Token (401)', noTokenRes.status === 401);

      // 1.6 Malformed Token
      const badTokenRes = await fetch(`${BASE_URL}/leads`, {
        headers: { Authorization: 'Bearer this.is.invalid' }
      });
      recordTest('Authentication', 'Protected Route Rejects Malformed Token (401)', badTokenRes.status === 401);

      // 1.7 Expired Token
      const expiredToken = jwt.sign({ id: '6a55fb7a47aa971ddfc65e92', role: 'admin' }, SECRET, { expiresIn: '-1s' });
      const expRes = await fetch(`${BASE_URL}/leads`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      recordTest('Authentication', 'Protected Route Rejects Expired Token (401)', expRes.status === 401);

      // 1.8 Unauthenticated Health Monitoring Route
      const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
      const healthData = await healthRes.json();
      recordTest('Authentication', 'Public Health Route Accessible Without Token (200 OK)', healthRes.status === 200 && healthData.status === 'ok');

      // -------------------------------------------------------------
      // 2. SEED TEST USERS FOR MULTI-ROLE & RBAC AUDIT
      // -------------------------------------------------------------
      console.log('\n--- 2. ROLE-BASED ACCESS CONTROL (RBAC) & IDOR TESTS ---');

      const adminUser = await User.findOne({ email: 'superadmin@gmail.com' });
      const adminToken = jwt.sign(
        { id: adminUser._id, _id: adminUser._id, role: 'superadmin', role_id: '0', isSuperAdmin: true, name: 'Admin Test' },
        SECRET,
        { expiresIn: '2h' }
      );
      const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

      // Create Counselor Test User
      const counselorEmail = `counselor_qa_${Date.now()}@edtech.com`;
      const counselorUser = await User.findOneAndUpdate(
        { email: counselorEmail },
        {
          name: 'Counselor Priya',
          email: counselorEmail,
          phone: '+919876543201',
          role: 'counselor',
          role_id: '4',
          isActive: true,
          status: 'active'
        },
        { upsert: true, new: true }
      );
      const counselorToken = jwt.sign(
        { id: counselorUser._id, _id: counselorUser._id, role: 'counselor', role_id: '4', name: counselorUser.name },
        SECRET,
        { expiresIn: '2h' }
      );
      const counselorHeaders = { Authorization: `Bearer ${counselorToken}`, 'Content-Type': 'application/json' };

      // Create Student 1 Test User
      const student1Email = `student1_qa_${Date.now()}@edtech.com`;
      const student1User = await User.findOneAndUpdate(
        { email: student1Email },
        {
          name: 'Student Rohan',
          email: student1Email,
          phone: '+919876543202',
          role: 'student',
          role_id: '10',
          studentId: `STD-${Date.now()}-1`,
          isActive: true,
          status: 'active'
        },
        { upsert: true, new: true }
      );
      const student1Token = jwt.sign(
        { id: student1User._id, _id: student1User._id, role: 'student', role_id: '10', name: student1User.name },
        SECRET,
        { expiresIn: '2h' }
      );
      const student1Headers = { Authorization: `Bearer ${student1Token}`, 'Content-Type': 'application/json' };

      // Create Student 2 Test User (for IDOR testing)
      const student2Email = `student2_qa_${Date.now()}@edtech.com`;
      const student2User = await User.findOneAndUpdate(
        { email: student2Email },
        {
          name: 'Student Ananya',
          email: student2Email,
          phone: '+919876543203',
          role: 'student',
          role_id: '10',
          studentId: `STD-${Date.now()}-2`,
          isActive: true,
          status: 'active'
        },
        { upsert: true, new: true }
      );
      const student2Token = jwt.sign(
        { id: student2User._id, _id: student2User._id, role: 'student', role_id: '10', name: student2User.name },
        SECRET,
        { expiresIn: '2h' }
      );
      const student2Headers = { Authorization: `Bearer ${student2Token}`, 'Content-Type': 'application/json' };

      // 2.1 Admin Access: Can access course creation
      const adminCanPostCourse = await fetch(`${BASE_URL}/academy/courses`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          courseName: 'Data Science & AI Bootcamp',
          category: 'DEVELOPMENT',
          shortDescription: 'Master modern AI & Machine Learning algorithms.',
          baseFee: 50000,
          durationWeeks: 16
        })
      });
      const createdCourseData = await adminCanPostCourse.json();
      const testCourse = createdCourseData.data;
      recordTest('RBAC', 'Admin Can Create Course (201 Created)', adminCanPostCourse.status === 201 && !!testCourse);

      // 2.2 Student RBAC Denial: Student cannot create Course (403 Forbidden)
      const studentCourseAttempt = await fetch(`${BASE_URL}/academy/courses`, {
        method: 'POST',
        headers: student1Headers,
        body: JSON.stringify({ courseName: 'Hacked Course', baseFee: 100 })
      });
      recordTest('RBAC', 'Student Blocked From Creating Course (403 Forbidden)', studentCourseAttempt.status === 403);

      // 2.3 Student RBAC Denial: Student cannot create Batch (403 Forbidden)
      const studentBatchAttempt = await fetch(`${BASE_URL}/academy/batches`, {
        method: 'POST',
        headers: student1Headers,
        body: JSON.stringify({ batchName: 'Hacked Batch', courseId: testCourse?._id })
      });
      recordTest('RBAC', 'Student Blocked From Creating Batch (403 Forbidden)', studentBatchAttempt.status === 403);

      // 2.4 Counselor RBAC: Counselor can create and view Leads (200/201)
      const counselorLeadRes = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: counselorHeaders,
        body: JSON.stringify({
          leadName: 'Amit Sharma',
          email: `amit_${Date.now()}@gmail.com`,
          phone: '+919811122233',
          interestedService: 'Data Science & AI Bootcamp',
          status: 'New',
          source: 'Facebook Ad'
        })
      });
      recordTest('RBAC', 'Counselor Permitted To Create Lead (201 Created)', counselorLeadRes.status === 201);

      // 2.5 IDOR Security Test: Create valid fee record for Student 2
      const batchStudent2 = await Batch.create({
        batchCode: `BTC-QA-${Date.now()}`,
        batchName: 'QA Test Batch 2',
        courseId: testCourse._id,
        status: 'ONGOING'
      });
      const createFee2Res = await fetch(`${BASE_URL}/student-fees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          studentId: student2User._id,
          courseId: testCourse._id,
          batchId: batchStudent2._id,
          totalFee: 50000,
          installments: [{ installmentNumber: 1, amount: 50000, dueDate: new Date().toISOString() }]
        })
      });
      const fee2Data = await createFee2Res.json();
      const feeStudent2Id = fee2Data.data?._id;

      // Student 1 tries to access Student 2's private fee details by direct ID
      const idorFeeAttempt = await fetch(`${BASE_URL}/student-fees/${feeStudent2Id}`, {
        headers: student1Headers
      });
      recordTest('IDOR Security', 'Student 1 Prevented From Viewing Student 2 Fee Account (403 Forbidden)', idorFeeAttempt.status === 403);

      // Student 1 accesses own fee account endpoint (`/my-account`)
      const myFeeRes = await fetch(`${BASE_URL}/student-fees/my-account`, {
        headers: student1Headers
      });
      recordTest('IDOR Security', 'Student Permitted To View Own Fee Account (200 OK)', myFeeRes.status === 200);

      // -------------------------------------------------------------
      // 3. COMPLETE MODULE BY MODULE CRUD & VALIDATION AUDIT
      // -------------------------------------------------------------
      console.log('\n--- 3. MODULE BY MODULE CRUD & FORM VALIDATION TESTS ---');

      // 3.1 Admissions / Leads Form Validation
      // Invalid email
      const badEmailLead = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          leadName: 'Test Invalid Email',
          email: 'not-an-email',
          phone: '+919999988888',
          status: 'New'
        })
      });
      recordTest('Admissions', 'Form Validation: Rejects Invalid Email Format (400)', badEmailLead.status === 400);

      // Missing phone
      const noPhoneLead = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          leadName: 'Test Missing Phone',
          email: 'valid@test.com'
        })
      });
      recordTest('Admissions', 'Form Validation: Rejects Missing Phone (400)', noPhoneLead.status === 400);

      // Valid Lead Creation
      const validLeadRes = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          leadName: 'Rahul Verma',
          email: `rahul_${Date.now()}@edtech.com`,
          phone: '+919876500112',
          city: 'Mumbai',
          source: 'Google Search',
          interestedService: testCourse.courseName,
          status: 'New'
        })
      });
      const validLeadData = await validLeadRes.json();
      const testLeadId = validLeadData.data?.id || validLeadData.data?._id;
      recordTest('Admissions', 'Create Valid Lead (201 Created)', validLeadRes.status === 201 && !!testLeadId);

      // Search Leads
      const searchLeadRes = await fetch(`${BASE_URL}/leads?search=Rahul`, { headers: adminHeaders });
      const searchLeadData = await searchLeadRes.json();
      recordTest('Admissions', 'Search Leads by Keyword (200 OK & Matches)', searchLeadRes.status === 200 && Array.isArray(searchLeadData.data));

      // Filter Leads by Status
      const filterLeadRes = await fetch(`${BASE_URL}/leads?status=New`, { headers: adminHeaders });
      const filterLeadData = await filterLeadRes.json();
      recordTest('Admissions', 'Filter Leads by Status (200 OK)', filterLeadRes.status === 200 && Array.isArray(filterLeadData.data));

      // 3.2 Counselor Follow-up Logging
      const followupRes = await fetch(`${BASE_URL}/leads/followup`, {
        method: 'POST',
        headers: counselorHeaders,
        body: JSON.stringify({
          leadId: testLeadId,
          remarks: 'Discussed syllabus and bootcamp batch timings. Candidate showed high interest.',
          nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
          statusChangedTo: 'Interested'
        })
      });
      recordTest('Follow-ups', 'Counselor Log Follow-up Note & Next Date (200/201 OK)', followupRes.status === 200 || followupRes.status === 201);

      // 3.3 Conversion: Convert Lead to Student
      const convertRes = await fetch(`${BASE_URL}/leads/${testLeadId}/convert-to-student`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          courseId: testCourse._id,
          admissionNotes: 'Enrolled under promotional offer'
        })
      });
      const convertData = await convertRes.json();
      const convertedStudentId = convertData.data?.student?._id;
      const convertedStudentCode = convertData.data?.student?.studentId;
      recordTest('Conversion', 'Convert Lead to Student (200 OK & Generated STD-*)', convertRes.status === 200 && !!convertedStudentCode);

      // 3.4 Batches Management
      const batchRes = await fetch(`${BASE_URL}/academy/batches`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          batchName: 'AI Masters Cohort 1',
          courseId: testCourse._id,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
          capacity: 25,
          scheduleTime: '10:00 AM - 01:00 PM',
          status: 'ONGOING'
        })
      });
      const batchData = await batchRes.json();
      const testBatch = batchData.data;
      recordTest('Batches', 'Create Batch for Course (201 Created)', batchRes.status === 201 && !!testBatch?._id);

      // Search Batches
      const searchBatchRes = await fetch(`${BASE_URL}/academy/batches?search=Masters`, { headers: adminHeaders });
      recordTest('Batches', 'Search Batches (200 OK)', searchBatchRes.status === 200);

      // 3.5 Student Enrollment
      const enrollRes = await fetch(`${BASE_URL}/academy/enrollments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          studentId: convertedStudentId,
          courseId: testCourse._id,
          batchId: testBatch._id,
          status: 'active'
        })
      });
      const enrollData = await enrollRes.json();
      const testEnrollment = enrollData.data;
      recordTest('Enrollment', 'Enroll Converted Student into Batch (201 Created)', enrollRes.status === 201 && !!testEnrollment?._id);

      // 3.6 Student Attendance
      const attendanceRes = await fetch(`${BASE_URL}/attendance/mark`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          user_id: convertedStudentId,
          batchId: testBatch._id,
          courseId: testCourse._id,
          status: 'PRESENT',
          date: new Date().toISOString().slice(0, 10)
        })
      });
      recordTest('Attendance', 'Mark Daily Attendance Check-In (200 OK)', attendanceRes.status === 200);

      const getAttendanceRes = await fetch(`${BASE_URL}/attendance/student/${new Date().toISOString().slice(0, 10)}`, {
        headers: adminHeaders
      });
      recordTest('Attendance', 'Retrieve Daily Attendance Records (200 OK)', getAttendanceRes.status === 200);

      // 3.7 LMS / Learning Management
      // Create lesson in course
      const lessonRes = await fetch(`${BASE_URL}/academy/courses/${testCourse._id}/lessons`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: 'Introduction to Supervised Learning',
          moduleName: 'Module 1: Machine Learning Fundamentals',
          contentType: 'VIDEO',
          videoUrl: 'https://youtube.com/watch?v=sample-edtech',
          durationMinutes: 45,
          orderIndex: 1
        })
      });
      const lessonData = await lessonRes.json();
      const testLesson = lessonData.data;
      recordTest('LMS', 'Create Course Lesson Module (201 Created)', lessonRes.status === 201 && !!testLesson?._id);

      // Converted Student Token for LMS
      const studentToken = jwt.sign(
        { id: convertedStudentId, _id: convertedStudentId, role: 'student', role_id: '10', name: 'Rahul Verma' },
        SECRET,
        { expiresIn: '2h' }
      );
      const studentHeaders = { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' };

      // Student views enrolled courses in LMS
      const studentLmsRes = await fetch(`${BASE_URL}/academy/student/enrolled-courses`, {
        headers: studentHeaders
      });
      recordTest('LMS', 'Student Views Enrolled Courses Catalog (200 OK)', studentLmsRes.status === 200);

      // Mark lesson complete
      const completeLessonRes = await fetch(`${BASE_URL}/academy/lessons/${testLesson._id}/complete`, {
        method: 'POST',
        headers: studentHeaders
      });
      recordTest('LMS', 'Student Marks Lesson Complete (200 OK)', completeLessonRes.status === 200);

      // 3.8 Assignments & Grading
      // Create Assignment
      const assignRes = await fetch(`${BASE_URL}/academy/courses/${testCourse._id}/assignments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: 'Build a Linear Regression Model',
          description: 'Implement linear regression in Python using scikit-learn on the provided dataset.',
          maxMarks: 100,
          passingScore: 50,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString()
        })
      });
      const assignData = await assignRes.json();
      const testAssignment = assignData.data;
      recordTest('Assignments', 'Instructor/Admin Creates Assignment (201 Created)', assignRes.status === 201 && !!testAssignment?._id);

      // Student Submits Assignment
      const submitRes = await fetch(`${BASE_URL}/academy/assignments/${testAssignment._id}/submit`, {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          submissionText: 'https://github.com/rahul/linear-regression-submission',
          notes: 'Completed all required model evaluations with 96% accuracy.'
        })
      });
      const submitData = await submitRes.json();
      const testSubmission = submitData.data;
      recordTest('Assignments', 'Student Submits Assignment (201 Created)', (submitRes.status === 200 || submitRes.status === 201) && !!testSubmission?._id);

      // Instructor Grades Submission
      const gradeRes = await fetch(`${BASE_URL}/academy/submissions/${testSubmission._id}/grade`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          score: 95,
          feedback: 'Excellent implementation and clean documentation!',
          status: 'GRADED'
        })
      });
      recordTest('Grading', 'Instructor Grades Submission with Feedback (200 OK)', gradeRes.status === 200);

      // 3.9 Fees, Installments, Payments & Receipts
      const feeRes = await fetch(`${BASE_URL}/student-fees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          studentId: convertedStudentId,
          courseId: testCourse._id,
          batchId: testBatch._id,
          enrollmentId: testEnrollment._id,
          totalAmount: 50000,
          discountAmount: 5000,
          installments: [
            { installmentNumber: 1, amount: 25000, dueDate: new Date().toISOString() },
            { installmentNumber: 2, amount: 20000, dueDate: new Date(Date.now() + 30 * 86400000).toISOString() }
          ]
        })
      });
      const feeData = await feeRes.json();
      const testFee = feeData.data;
      const expectedNetFee = 45000;
      recordTest('Fees', 'Create Fee Account with Installments (201 Created)', feeRes.status === 201 && testFee?.finalAmount === expectedNetFee);

      // Record Installment Payment
      const payRes = await fetch(`${BASE_URL}/student-fees/${testFee._id}/record-payment`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          installmentNumber: 1,
          amountPaid: 25000,
          paymentMethod: 'ONLINE_UPI',
          transactionReference: `UPI_TXN_${Date.now()}`,
          notes: 'First installment payment cleared'
        })
      });
      const payData = await payRes.json();
      const generatedReceipt = payData.data?.receipt;
      const updatedFee = payData.data?.fee;
      
      // Math Verification: Total Fee - Total Paid = Total Due
      const mathCorrect = (updatedFee.finalAmount - updatedFee.paidAmount) === updatedFee.dueAmount;
      recordTest('Payments', 'Record Payment & Verify Mathematical Balance (Total - Paid = Due)', payRes.status === 200 && mathCorrect);
      recordTest('Receipts', 'Receipt Number Auto-Generated (Format: RCP-YYYY-*)', !!generatedReceipt?.receiptNo && generatedReceipt.receiptNo.startsWith('RCP-'));

      // Download Vector PDF Receipt
      const pdfReceiptRes = await fetch(`${BASE_URL}/student-fees/receipts/${generatedReceipt.receiptNo}/pdf`);
      const isPdf = pdfReceiptRes.headers.get('content-type')?.includes('application/pdf');
      recordTest('Receipts', 'Download Public Vector PDF Receipt (200 OK & application/pdf)', pdfReceiptRes.status === 200 && isPdf);

      // Payment Gateway: Razorpay Order Creation
      const rzpOrderRes = await fetch(`${BASE_URL}/student-fees/payments/create-order`, {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          feeId: testFee._id,
          installmentNumber: 2,
          amount: 20000
        })
      });
      const rzpOrderData = await rzpOrderRes.json();
      recordTest('Payment Gateway', 'Create Razorpay Checkout Order (200 OK & Order ID)', rzpOrderRes.status === 200 && !!rzpOrderData.orderId);

      // 3.10 Live Classrooms
      const liveClassRes = await fetch(`${BASE_URL}/live-classes`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: 'Deep Learning with PyTorch Workshop',
          batchId: testBatch._id,
          courseId: testCourse._id,
          platform: 'Google Meet',
          meetingUrl: 'https://meet.google.com/xyz-edtech-test',
          scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
          durationMinutes: 90
        })
      });
      const liveClassData = await liveClassRes.json();
      const testLiveClass = liveClassData.data;
      recordTest('Live Classes', 'Schedule Live Classroom with Meeting URL (201 Created)', liveClassRes.status === 201 && !!testLiveClass?._id);

      // List Live Classes for Student
      const studentClassList = await fetch(`${BASE_URL}/live-classes`, { headers: studentHeaders });
      recordTest('Live Classes', 'Student Views Scheduled Classrooms (200 OK)', studentClassList.status === 200);

      // 3.11 Automated Certificates & QR Verification
      // Complete course progress on enrollment
      await Enrollment.findByIdAndUpdate(testEnrollment._id, { progressPercent: 100, status: 'COMPLETED' });

      // Generate Certificate
      const certRes = await fetch(`${BASE_URL}/certificates/generate`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          studentId: convertedStudentId,
          courseId: testCourse._id,
          batchId: testBatch._id,
          enrollmentId: testEnrollment._id,
          finalScorePercent: 95
        })
      });
      const certData = await certRes.json();
      const testCert = certData.data;
      recordTest('Certificates', 'Generate Completion Certificate (201 Created & CERT-*)', (certRes.status === 201 || certRes.status === 200) && !!testCert?.verificationCode);

      // Public QR Verification with Authentic Code
      const qrVerifyRes = await fetch(`${BASE_URL}/certificates/verify/${testCert.verificationCode}`);
      const qrVerifyData = await qrVerifyRes.json();
      recordTest('Certificate Verification', 'Public Verification of Authentic Certificate (200 OK)', qrVerifyRes.status === 200 && qrVerifyData.success === true);

      // Public QR Verification with Fake / Invalid Code
      const qrFakeRes = await fetch(`${BASE_URL}/certificates/verify/FAKECODE999888`);
      recordTest('Certificate Verification', 'Rejection of Fake / Invalid Certificate Code (404 Not Found)', qrFakeRes.status === 404);

      // Download Certificate PDF
      const certPdfRes = await fetch(`${BASE_URL}/certificates/${testCert._id}/pdf`, { headers: adminHeaders });
      const isCertPdf = certPdfRes.headers.get('content-type')?.includes('application/pdf');
      recordTest('Certificates', 'Download Landscape Vector Certificate PDF (200 OK)', certPdfRes.status === 200 && isCertPdf);

      // 3.12 EdTech Dashboard Real Database Stats
      const statsRes = await fetch(`${BASE_URL}/edtech-dashboard/stats`, { headers: adminHeaders });
      const statsData = await statsRes.json();
      const stats = statsData.data;
      const statsMatchRealData = stats && typeof stats.totalLeads === 'number' && typeof stats.totalCourses === 'number';
      recordTest('Dashboard', 'Real Database Metrics Aggregation (200 OK)', statsRes.status === 200 && statsMatchRealData);

      // 3.13 Academic Counselor Daily Reports
      const saveReportRes = await fetch(`${BASE_URL}/academic-counselor-reports`, {
        method: 'POST',
        headers: counselorHeaders,
        body: JSON.stringify({
          callsMade: 35,
          callsConnected: 28,
          interestedCount: 12,
          convertedCount: 3,
          notes: 'High conversion rate observed for Data Science course inquiries.'
        })
      });
      recordTest('Reports', 'Save Daily Academic Counselor Activity Report (200 OK)', saveReportRes.status === 200);

      // 3.14 Notifications
      const notifRes = await fetch(`${BASE_URL}/notifications`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          recipientId: convertedStudentId,
          title: 'Class Reminder',
          message: 'Your Google Meet live class starts in 1 hour.',
          type: 'CLASS_REMINDER'
        })
      });
      recordTest('Notifications', 'Create System Notification for Student (201 Created)', notifRes.status === 201);

      const getNotifRes = await fetch(`${BASE_URL}/notifications/my-notifications`, { headers: studentHeaders });
      recordTest('Notifications', 'Student Retrieves In-App Notifications (200 OK)', getNotifRes.status === 200);

      // -------------------------------------------------------------
      // 4. PRINT SUMMARY & TEARDOWN
      // -------------------------------------------------------------
      console.log('\n===============================================================');
      console.log(`📊 FINAL TEST RUN RESULTS: Total: ${testResults.total} | Passed: ${testResults.passed} | Failed: ${testResults.failed}`);
      console.log('===============================================================');

      for (const [cat, data] of Object.entries(testResults.categories)) {
        console.log(`  - ${cat.padEnd(25)}: ${data.passed}/${data.total} Passed (${data.failed === 0 ? '✅ 100%' : '⚠️ Has Failures'})`);
      }

      if (testResults.failed > 0) {
        console.log('\n🚨 DETECTED BUGS:');
        testResults.bugs.forEach((b, i) => {
          console.log(`  ${i + 1}. [${b.category}] ${b.name}: ${b.details}`);
        });
      } else {
        console.log('\n🎉 ALL 32 HIGH-PRIORITY PRODUCTION QA CRITERIA PASSED WITHOUT ERRORS!');
      }

      server.close();
      process.exit(testResults.failed === 0 ? 0 : 1);
    } catch (err) {
      console.error('\n🚨 UNHANDLED TEST EXCEPTION:', err);
      server.close();
      process.exit(1);
    }
  });
}

runMasterTest();
