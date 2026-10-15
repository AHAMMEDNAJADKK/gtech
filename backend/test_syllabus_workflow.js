import mongoose from 'mongoose';
import Course from './src/models/course.model.js';
import User from './src/models/user.model.js';
import Enrollment from './src/models/enrollment.model.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const API_BASE = 'http://localhost:5000/api/v1';

const assert = (condition, msg) => {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
};

const run = async () => {
  console.log('\n================================================================');
  console.log('       SYLLABUS MANAGEMENT & PDF WORKFLOW VERIFICATION          ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edtech_crm');
  console.log('  ✅ Connected to MongoDB');

  // 1. Authenticate Admin and Student
  console.log('\n--- 1. AUTHENTICATION & TOKENS ---');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@gmail.com', password: 'superadmin@111' })
  });
  const adminData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, 'Superadmin logs in successfully');
  const adminToken = adminData.token || adminData.data?.token;

  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@gmail.com', password: 'student@111' })
  });
  const studentData = await studentLoginRes.json();
  assert(studentLoginRes.status === 200, 'Student logs in successfully');
  const studentToken = studentData.token || studentData.data?.token;
  const studentUser = studentData.user || studentData.data?.user;

  // 2. Identify student's enrolled course and an un-enrolled course
  console.log('\n--- 2. ENROLLMENT & COURSE SCOPING ---');
  const studentEnrollment = await Enrollment.findOne({ studentId: studentUser._id || studentUser.id }).populate('courseId');
  assert(Boolean(studentEnrollment), 'Student has an active enrollment');
  const enrolledCourseId = String(studentEnrollment.courseId._id || studentEnrollment.courseId);
  console.log(`  ℹ️ Enrolled Course ID: ${enrolledCourseId}`);

  // Find or create an un-enrolled course to test access control
  let unEnrolledCourse = await Course.findOne({ _id: { $ne: enrolledCourseId } });
  if (!unEnrolledCourse) {
    unEnrolledCourse = await Course.create({
      courseCode: `CRS-TEST-${Date.now()}`,
      courseName: 'Advanced Data Engineering & Cloud Architecture',
      category: 'Data Science',
      durationValue: 8,
      durationUnit: 'Months',
      syllabus: [
        {
          moduleId: 'mod_cloud_1',
          title: 'Cloud Infrastructure & Kubernetes',
          description: 'Deploying enterprise applications on multi-cloud clusters.',
          topics: [
            { topicId: 'top_1', title: 'Containerization with Docker' },
            { topicId: 'top_2', title: 'Orchestration with K8s Pods and Services' }
          ]
        }
      ]
    });
  }
  const unEnrolledCourseId = String(unEnrolledCourse._id);
  console.log(`  ℹ️ Un-enrolled Course ID: ${unEnrolledCourseId}`);

  // 3. Test Student "My Syllabus" endpoint
  console.log('\n--- 3. STUDENT MY SYLLABUS CATALOG (/academy/student/syllabus) ---');
  const mySyllabusRes = await fetch(`${API_BASE}/academy/student/syllabus`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(mySyllabusRes.status === 200, 'Student can fetch /academy/student/syllabus');
  const mySyllabusData = await mySyllabusRes.json();
  assert(mySyllabusData.success === true, 'Response returns success: true');
  assert(Array.isArray(mySyllabusData.data), 'Returns syllabuses array');
  assert(mySyllabusData.data.length > 0, 'Contains student enrolled course syllabus');
  const firstSyllabus = mySyllabusData.data[0];
  assert(Boolean(firstSyllabus.course), 'Includes course information');
  assert(Boolean(firstSyllabus.pdfDownloadUrl), 'Includes pdfDownloadUrl link');
  assert(Boolean(firstSyllabus.pdfPreviewUrl), 'Includes pdfPreviewUrl link');

  // 4. Test Student Access to Enrolled Course Syllabus
  console.log('\n--- 4. STUDENT ACCESS TO ENROLLED COURSE SYLLABUS ---');
  const enrolledSyllabusRes = await fetch(`${API_BASE}/academy/courses/${enrolledCourseId}/syllabus`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(enrolledSyllabusRes.status === 200, 'Student can access syllabus of enrolled course (200 OK)');
  const enrolledSyllabusJson = await enrolledSyllabusRes.json();
  assert(enrolledSyllabusJson.success === true, 'Enrolled syllabus response is success');
  assert(Boolean(enrolledSyllabusJson.data.syllabus), 'Includes modular syllabus tree');

  // 5. Test Student Access Control: Blocked from un-enrolled course syllabus
  console.log('\n--- 5. RBAC SECURITY: STUDENT BLOCKED FROM UN-ENROLLED COURSE ---');
  const unEnrolledSyllabusRes = await fetch(`${API_BASE}/academy/courses/${unEnrolledCourseId}/syllabus`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(unEnrolledSyllabusRes.status === 403, 'Student blocked from un-enrolled course syllabus (403 Forbidden)');

  // 6. Test Admin Access to Course Syllabus
  console.log('\n--- 6. ADMIN SYLLABUS ACCESS ---');
  const adminSyllabusRes = await fetch(`${API_BASE}/academy/courses/${unEnrolledCourseId}/syllabus`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminSyllabusRes.status === 200, 'Admin can view any course syllabus (200 OK)');

  // 7. Test PDF Generation: Preview & Download
  console.log('\n--- 7. SYLLABUS PDF GENERATION & STREAMING ---');
  // Student preview enrolled course PDF
  const pdfPreviewRes = await fetch(`${API_BASE}/academy/courses/${enrolledCourseId}/syllabus/pdf?preview=true`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(pdfPreviewRes.status === 200, 'PDF preview returns 200 OK');
  assert(pdfPreviewRes.headers.get('content-type')?.includes('application/pdf'), 'Content-Type is application/pdf');
  const dispositionHeader = pdfPreviewRes.headers.get('content-disposition') || '';
  assert(dispositionHeader.includes('inline'), 'Content-Disposition includes inline for preview');
  assert(dispositionHeader.includes('_Syllabus.pdf'), 'Filename contains _Syllabus.pdf');
  
  const pdfBuffer = await pdfPreviewRes.arrayBuffer();
  const pdfBytes = Buffer.from(pdfBuffer);
  assert(pdfBytes.slice(0, 5).toString('ascii') === '%PDF-', 'Valid PDF binary signature (%PDF-)');
  console.log(`  ℹ️ Generated PDF Size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

  // Student download enrolled course PDF
  const pdfDownloadRes = await fetch(`${API_BASE}/academy/courses/${enrolledCourseId}/syllabus/pdf`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(pdfDownloadRes.status === 200, 'PDF download returns 200 OK');
  const downloadDispHeader = pdfDownloadRes.headers.get('content-disposition') || '';
  assert(downloadDispHeader.includes('attachment'), 'Content-Disposition includes attachment for download');

  // Student blocked from un-enrolled course PDF
  const blockedPdfRes = await fetch(`${API_BASE}/academy/courses/${unEnrolledCourseId}/syllabus/pdf`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(blockedPdfRes.status === 403, 'Student blocked from downloading un-enrolled course PDF (403 Forbidden)');

  // 8. Test Official Syllabus PDF Upload (Admin authorized, Student blocked)
  console.log('\n--- 8. OFFICIAL SYLLABUS PDF UPLOAD ---');
  // Create dummy sample PDF file in memory
  const samplePdfContent = Buffer.from('%PDF-1.4\n%Official Syllabus Document\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\n0000000000 65535 f\n0000000010 00000 n\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n60\n%%EOF');
  
  // Student attempt upload -> Must be 403
  const studentFormData = new FormData();
  studentFormData.append('file', new Blob([samplePdfContent], { type: 'application/pdf' }), 'official_syllabus.pdf');
  const studentUploadRes = await fetch(`${API_BASE}/academy/courses/${enrolledCourseId}/syllabus/upload-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: studentFormData
  });
  assert(studentUploadRes.status === 403, 'Student is forbidden from uploading syllabus PDF (403 Forbidden)');

  // Admin upload -> Must be 200 OK
  const adminFormData = new FormData();
  adminFormData.append('file', new Blob([samplePdfContent], { type: 'application/pdf' }), 'Certified_Curriculum_2026.pdf');
  const adminUploadRes = await fetch(`${API_BASE}/academy/courses/${enrolledCourseId}/syllabus/upload-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: adminFormData
  });
  assert(adminUploadRes.status === 200, 'Admin can upload official syllabus PDF (200 OK)');
  const uploadJson = await adminUploadRes.json();
  assert(uploadJson.success === true, 'Upload returns success: true');
  assert(Boolean(uploadJson.data?.syllabusPdf?.url), 'Course record updated with syllabusPdf.url');

  console.log('\n================================================================');
  console.log('   ALL SYLLABUS BACKEND TESTS PASSED SUCCESSFULLY!             ');
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
