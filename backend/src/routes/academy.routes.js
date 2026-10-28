import { Router } from 'express';
import protectRoute, { requireAdminOrStaff, requireSuperAdmin } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';
import courseController from '../controllers/course.controller.js';
import batchController from '../controllers/batch.controller.js';
import enrollmentController from '../controllers/enrollment.controller.js';
import lmsController from '../controllers/lms.controller.js';

const router = Router();

// Protect all Academy Module endpoints
router.use(protectRoute);

// Eligible Instructors List
router.get('/instructors', courseController.getEligibleInstructors);

// Course Management Routes (Module 4.2)
router.get('/courses', courseController.getCourses);
router.post('/courses', requireAdminOrStaff, courseController.createCourse);
router.get('/courses/:id', courseController.getCourseById);
router.put('/courses/:id', courseController.updateCourse);
router.patch('/courses/:id', courseController.updateCourse);
router.post('/courses/:id/archive', courseController.archiveCourse);
router.post('/courses/:id/activate', courseController.activateCourse);
router.put('/courses/:id/syllabus', courseController.updateSyllabus);
router.get('/courses/:id/syllabus', courseController.getCourseSyllabus);
router.get('/courses/:id/syllabus/pdf', courseController.downloadSyllabusPdf);
router.post('/courses/:id/syllabus/upload-pdf', requireAdminOrStaff, upload.single('file'), courseController.uploadSyllabusPdf);
router.get('/student/syllabus', courseController.getStudentSyllabuses);
router.get('/my-syllabus', courseController.getStudentSyllabuses);
router.delete('/courses/:id', courseController.deleteCourse);

// Batch Management Routes (Module 4.2)
router.get('/batches', batchController.getBatches);
router.post('/batches', requireAdminOrStaff, batchController.createBatch);
router.get('/batches/:id', batchController.getBatchById);
router.put('/batches/:id', batchController.updateBatch);
router.patch('/batches/:id', batchController.updateBatch);
router.patch('/batches/:id/students', batchController.addStudentsToBatch);
router.delete('/batches/:id/students/:studentId', batchController.removeStudentFromBatch);
router.post('/batches/:id/cancel', batchController.cancelBatch);
router.delete('/batches/:id', batchController.deleteBatch);

// Enrollment & Progress Tracking Routes (Module 4.3)
router.get('/enrollments', enrollmentController.getEnrollments);
router.post('/enrollments', requireAdminOrStaff, enrollmentController.createEnrollment);
router.get('/enrollments/:id', enrollmentController.getEnrollmentById);
router.patch('/enrollments/:id/progress', requireAdminOrStaff, enrollmentController.updateProgress);
router.patch('/enrollments/:id/status', requireAdminOrStaff, enrollmentController.updateStatus);
router.delete('/enrollments/:id', requireSuperAdmin, enrollmentController.deleteEnrollment);

// ============================================================
// LMS LEARNING MANAGEMENT SYSTEM ROUTES (Module 4.4)
// ============================================================

// Student Enrolled Courses Catalog
router.get('/student/enrolled-courses', lmsController.getStudentEnrolledCourses);
router.get('/my-courses', lmsController.getStudentEnrolledCourses);

// Course LMS Content Delivery
router.get('/courses/:courseId/lms-content', lmsController.getCourseLmsContent);

// Lesson Management
router.post('/courses/:courseId/lessons', requireAdminOrStaff, lmsController.createLesson);
router.patch('/lessons/:lessonId', requireAdminOrStaff, lmsController.updateLesson);
router.delete('/lessons/:lessonId', requireAdminOrStaff, lmsController.deleteLesson);
router.post('/lessons/:lessonId/complete', lmsController.completeLesson);

// Assignment Management
router.get('/my-submissions', lmsController.getMySubmissions);
router.get('/assignments/my-submissions', lmsController.getMySubmissions);
router.get('/submissions/my-submissions', lmsController.getMySubmissions);
router.get('/assignments', lmsController.getAllAssignments);
router.post('/assignments', requireAdminOrStaff, lmsController.createAssignment);
router.get('/assignments/:assignmentId', lmsController.getAssignmentById);
router.post('/courses/:courseId/assignments', requireAdminOrStaff, lmsController.createAssignment);
router.patch('/assignments/:assignmentId', requireAdminOrStaff, lmsController.updateAssignment);
router.delete('/assignments/:assignmentId', requireAdminOrStaff, lmsController.deleteAssignment);
router.get('/assignments/:assignmentId/submissions', requireAdminOrStaff, lmsController.getAssignmentSubmissions);
router.post('/assignments/:assignmentId/submit', lmsController.submitAssignment);
router.get('/grading/submissions', requireAdminOrStaff, lmsController.getGradingQueue);
router.patch('/submissions/:submissionId/grade', requireAdminOrStaff, lmsController.gradeSubmission);
router.post('/submissions/:submissionId/grade', requireAdminOrStaff, lmsController.gradeSubmission);
router.post('/assignments/submissions/:submissionId/grade', requireAdminOrStaff, lmsController.gradeSubmission);
router.patch('/assignments/submissions/:submissionId/grade', requireAdminOrStaff, lmsController.gradeSubmission);
router.patch('/assignments/:assignmentId/grade', requireAdminOrStaff, (req, res, next) => {
  if (!req.params.submissionId && req.body.submissionId) {
    req.params.submissionId = req.body.submissionId;
  }
  return lmsController.gradeSubmission(req, res, next);
});
router.post('/assignments/:assignmentId/grade', requireAdminOrStaff, (req, res, next) => {
  if (!req.params.submissionId && req.body.submissionId) {
    req.params.submissionId = req.body.submissionId;
  }
  return lmsController.gradeSubmission(req, res, next);
});

// LMS Upload Service Endpoint (Supports students uploading submissions as well as staff creating materials)
router.post('/lms/upload', upload.single('file'), lmsController.uploadLmsFile);

export default router;
