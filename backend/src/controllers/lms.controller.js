import mongoose from 'mongoose';
import Course from '../models/course.model.js';
import Enrollment from '../models/enrollment.model.js';
import Lesson from '../models/lesson.model.js';
import LessonProgress from '../models/lessonProgress.model.js';
import Assignment from '../models/assignment.model.js';
import AssignmentSubmission from '../models/assignmentSubmission.model.js';
import User from '../models/user.model.js';
import { uploadToCloudinary } from '../utils/cloudinary.util.js';

const recordAudit = async (req, auditData) => {
  try {
    const auditModule = await import('../services/audit.service.js').catch(() => null);
    if (auditModule && auditModule.recordAudit) {
      await auditModule.recordAudit(req, auditData);
    }
  } catch (e) {
    // Non-blocking audit fallback
  }
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const lmsController = {
  /**
   * GET /api/v1/academy/courses/:courseId/lms-content
   * Fetch course modules, lessons, and assignments
   * Gated by student enrollment if requester role is 'student'
   */
  getCourseLmsContent: async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const userId = req.user?.id || req.user?._id;
      const userRole = (req.user?.role || '').toLowerCase();
      const userRoleId = String(req.user?.role_id || '');

      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new AppError('Invalid course ID format.', 400);
      }

      const course = await Course.findById(courseId).lean();
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const isStudent = userRole === 'student' || userRoleId === '10';

      // Enrollment Access Gating for Student Role
      let enrollment = null;
      if (isStudent) {
        enrollment = await Enrollment.findOne({
          studentId: userId,
          courseId,
          status: { $in: ['active', 'completed', 'paused'] }
        }).lean();

        if (!enrollment) {
          throw new AppError('Access denied. You do not have an active enrollment for this course.', 403);
        }
      }

      // Query Lessons
      const lessonQuery = { courseId };
      if (isStudent) {
        lessonQuery.isPublished = true;
      }
      const lessons = await Lesson.find(lessonQuery).sort({ order: 1, createdAt: 1 }).lean();

      // Query Assignments
      const assignmentQuery = { courseId };
      if (isStudent) {
        assignmentQuery.isPublished = true;
      }
      const assignments = await Assignment.find(assignmentQuery).sort({ createdAt: 1 }).lean();

      // Query Student Progress if student
      let completedLessonIds = [];
      let studentSubmissions = [];
      if (isStudent) {
        const completions = await LessonProgress.find({ studentId: userId, courseId }).select('lessonId').lean();
        completedLessonIds = completions.map(c => c.lessonId.toString());

        studentSubmissions = await AssignmentSubmission.find({ studentId: userId, courseId }).lean();
      }

      // Group Lessons & Assignments by Course Syllabus Modules
      const modules = (course.syllabus || []).map((mod, index) => {
        const modId = mod.moduleId || `mod_${index + 1}`;
        const modLessons = lessons.filter(l => l.moduleId === modId || l.moduleId === mod.title);
        const modAssignments = assignments.filter(a => a.moduleId === modId || a.moduleId === mod.title);

        return {
          moduleId: modId,
          title: mod.title,
          description: mod.description || '',
          order: mod.order || (index + 1),
          topics: mod.topics || [],
          lessons: modLessons.map(l => ({
            ...l,
            isCompleted: completedLessonIds.includes(l._id.toString())
          })),
          assignments: modAssignments.map(a => {
            const sub = studentSubmissions.find(s => s.assignmentId.toString() === a._id.toString());
            return {
              ...a,
              submission: sub || null
            };
          })
        };
      });

      // Include unassigned/general lessons & assignments if any exist
      const assignedModIds = (course.syllabus || []).map(m => m.moduleId || m.title);
      const orphanLessons = lessons.filter(l => !assignedModIds.includes(l.moduleId));
      const orphanAssignments = assignments.filter(a => !assignedModIds.includes(a.moduleId));

      if (orphanLessons.length > 0 || orphanAssignments.length > 0) {
        modules.push({
          moduleId: 'general_module',
          title: 'General Learning Materials & Assignments',
          description: 'Additional course materials and resources',
          order: 999,
          topics: [],
          lessons: orphanLessons.map(l => ({
            ...l,
            isCompleted: completedLessonIds.includes(l._id.toString())
          })),
          assignments: orphanAssignments.map(a => {
            const sub = studentSubmissions.find(s => s.assignmentId.toString() === a._id.toString());
            return {
              ...a,
              submission: sub || null
            };
          })
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          course: {
            _id: course._id,
            courseCode: course.courseCode,
            courseName: course.courseName,
            category: course.category,
            shortDescription: course.shortDescription,
            description: course.description
          },
          enrollment: enrollment || null,
          modules
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:courseId/lessons
   * Create new lesson inside a course module
   */
  createLesson: async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { 
        moduleId, title, description, contentType, fileUrl, fileMetadata,
        externalUrl, textContent, durationMinutes, order, isPublished 
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new AppError('Invalid course ID format.', 400);
      }

      if (!title || !title.trim()) {
        throw new AppError('Lesson title is required.', 400);
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const newLesson = await Lesson.create({
        courseId,
        moduleId: moduleId || (course.syllabus?.[0]?.moduleId || 'mod_1'),
        title: title.trim(),
        description: description ? description.trim() : '',
        contentType: contentType || 'TEXT',
        fileUrl: fileUrl || '',
        fileMetadata: fileMetadata || {},
        externalUrl: externalUrl ? externalUrl.trim() : '',
        textContent: textContent || '',
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 0,
        order: order ? parseInt(order, 10) : 1,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        createdBy: req.user?.id || req.user?._id
      });

      await recordAudit(req, {
        action: 'CREATE_LESSON',
        entity: 'Lesson',
        entityId: newLesson._id,
        newValue: newLesson
      });

      return res.status(201).json({
        success: true,
        message: 'Lesson created successfully.',
        data: newLesson
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/academy/lessons/:lessonId
   */
  updateLesson: async (req, res, next) => {
    try {
      const { lessonId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        throw new AppError('Invalid lesson ID format.', 400);
      }

      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        throw new AppError('Lesson not found.', 404);
      }

      const oldValue = lesson.toObject();
      const fields = [
        'title', 'description', 'contentType', 'fileUrl', 'fileMetadata',
        'externalUrl', 'textContent', 'durationMinutes', 'order', 'isPublished', 'moduleId'
      ];

      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          lesson[field] = req.body[field];
        }
      });

      lesson.updatedBy = req.user?.id || req.user?._id;
      await lesson.save();

      await recordAudit(req, {
        action: 'UPDATE_LESSON',
        entity: 'Lesson',
        entityId: lessonId,
        oldValue,
        newValue: lesson
      });

      return res.status(200).json({
        success: true,
        message: 'Lesson updated successfully.',
        data: lesson
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/academy/lessons/:lessonId
   */
  deleteLesson: async (req, res, next) => {
    try {
      const { lessonId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        throw new AppError('Invalid lesson ID format.', 400);
      }

      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        throw new AppError('Lesson not found.', 404);
      }

      await Lesson.findByIdAndDelete(lessonId);
      await LessonProgress.deleteMany({ lessonId });

      await recordAudit(req, {
        action: 'DELETE_LESSON',
        entity: 'Lesson',
        entityId: lessonId,
        oldValue: lesson
      });

      return res.status(200).json({
        success: true,
        message: 'Lesson deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/lessons/:lessonId/complete
   * Student marks lesson as complete; recalculates Enrollment.progressPercentage
   */
  completeLesson: async (req, res, next) => {
    try {
      const { lessonId } = req.params;
      const studentId = req.user?.id || req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        throw new AppError('Invalid lesson ID format.', 400);
      }

      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        throw new AppError('Lesson not found.', 404);
      }

      const courseId = lesson.courseId;

      // Verify Student Enrollment
      const enrollment = await Enrollment.findOne({
        studentId,
        courseId,
        status: { $in: ['active', 'completed', 'paused'] }
      });

      if (!enrollment) {
        throw new AppError('Enrollment record not found for this course.', 403);
      }

      // Record idempotent lesson progress
      await LessonProgress.findOneAndUpdate(
        { studentId, lessonId },
        { 
          studentId, 
          courseId, 
          lessonId, 
          completedAt: new Date() 
        },
        { upsert: true, new: true }
      );

      // Recalculate Enrollment Progress Percentage
      const totalPublishedLessons = await Lesson.countDocuments({ courseId, isPublished: true });
      const completedLessonsCount = await LessonProgress.countDocuments({ studentId, courseId });

      let progressPercentage = 0;
      if (totalPublishedLessons > 0) {
        progressPercentage = Math.min(100, Math.round((completedLessonsCount / totalPublishedLessons) * 100));
      }

      enrollment.progressPercentage = progressPercentage;
      enrollment.lastActivityAt = new Date();
      if (progressPercentage === 100 && enrollment.status === 'active') {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
      }
      await enrollment.save();

      return res.status(200).json({
        success: true,
        message: 'Lesson marked as complete.',
        data: {
          lessonId,
          completedLessonsCount,
          totalPublishedLessons,
          progressPercentage
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:courseId/assignments
   * Create new course assignment
   */
  createAssignment: async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { 
        moduleId, title, description, instructions, attachmentUrl, 
        maxMarks, dueDate, allowedSubmissionTypes, isPublished 
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new AppError('Invalid course ID format.', 400);
      }

      if (!title || !title.trim()) {
        throw new AppError('Assignment title is required.', 400);
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const parsedMaxMarks = parseInt(maxMarks, 10);
      if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
        throw new AppError('Maximum marks must be a positive number greater than 0.', 400);
      }

      const newAssignment = await Assignment.create({
        courseId,
        moduleId: moduleId || (course.syllabus?.[0]?.moduleId || 'mod_1'),
        title: title.trim(),
        description: description ? description.trim() : '',
        instructions: instructions ? instructions.trim() : '',
        attachmentUrl: attachmentUrl || '',
        maxMarks: parsedMaxMarks,
        dueDate: dueDate ? new Date(dueDate) : null,
        allowedSubmissionTypes: Array.isArray(allowedSubmissionTypes) && allowedSubmissionTypes.length > 0
          ? allowedSubmissionTypes
          : ['FILE', 'TEXT'],
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        createdBy: req.user?.id || req.user?._id
      });

      await recordAudit(req, {
        action: 'CREATE_ASSIGNMENT',
        entity: 'Assignment',
        entityId: newAssignment._id,
        newValue: newAssignment
      });

      return res.status(201).json({
        success: true,
        message: 'Assignment created successfully.',
        data: newAssignment
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/academy/assignments/:assignmentId
   */
  updateAssignment: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        throw new AppError('Assignment not found.', 404);
      }

      const oldValue = assignment.toObject();
      const fields = [
        'title', 'description', 'instructions', 'maxMarks',
        'dueDate', 'allowedSubmissionTypes', 'isPublished', 'moduleId', 'lessonId'
      ];

      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          if (field === 'maxMarks') {
            const parsed = parseInt(req.body.maxMarks, 10);
            if (parsed > 0) assignment.maxMarks = parsed;
          } else if (field === 'dueDate') {
            assignment.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
          } else {
            assignment[field] = req.body[field];
          }
        }
      });

      assignment.updatedBy = req.user?.id || req.user?._id;
      await assignment.save();

      await recordAudit(req, {
        action: 'UPDATE_ASSIGNMENT',
        entity: 'Assignment',
        entityId: assignmentId,
        oldValue,
        newValue: assignment
      });

      return res.status(200).json({
        success: true,
        message: 'Assignment updated successfully.',
        data: assignment
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/academy/assignments/:assignmentId
   */
  deleteAssignment: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        throw new AppError('Assignment not found.', 404);
      }

      await Assignment.findByIdAndDelete(assignmentId);
      await AssignmentSubmission.deleteMany({ assignmentId });

      await recordAudit(req, {
        action: 'DELETE_ASSIGNMENT',
        entity: 'Assignment',
        entityId: assignmentId,
        oldValue: assignment
      });

      return res.status(200).json({
        success: true,
        message: 'Assignment deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/assignments/:assignmentId/submit
   * Enrolled student submits solution to assignment
   */
  submitAssignment: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const studentId = req.user?.id || req.user?._id;
      const { submissionType, fileUrl, fileMetadata, textAnswer, externalUrl } = req.body;

      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        throw new AppError('Assignment not found.', 404);
      }

      if (!assignment.isPublished) {
        throw new AppError('Assignment is not accepting submissions.', 403);
      }

      const enrollment = await Enrollment.findOne({
        studentId,
        courseId: assignment.courseId,
        status: { $in: ['active', 'completed', 'paused'] }
      });

      if (!enrollment) {
        throw new AppError('You do not have an active enrollment for this course.', 403);
      }

      const submission = await AssignmentSubmission.findOneAndUpdate(
        { assignmentId, studentId },
        {
          assignmentId,
          studentId,
          courseId: assignment.courseId,
          enrollmentId: enrollment._id,
          submissionType: submissionType || 'FILE',
          fileUrl: fileUrl || '',
          fileMetadata: fileMetadata || {},
          textAnswer: textAnswer ? textAnswer.trim() : '',
          externalUrl: externalUrl ? externalUrl.trim() : '',
          submittedAt: new Date(),
          status: 'SUBMITTED',
          maxMarks: assignment.maxMarks
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Assignment submitted successfully.',
        data: submission
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/assignments/:assignmentId/submissions
   * Instructor/Admin fetches student submissions for an assignment
   */
  getAssignmentSubmissions: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId).lean();
      if (!assignment) {
        throw new AppError('Assignment not found.', 404);
      }

      const submissions = await AssignmentSubmission.find({ assignmentId })
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('gradedBy', 'name email')
        .sort({ submittedAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: {
          assignment,
          submissions
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/academy/submissions/:submissionId/grade
   * Instructor grades student submission with grade range validation
   */
  gradeSubmission: async (req, res, next) => {
    try {
      const { submissionId } = req.params;
      const { grade, feedback, status } = req.body;
      const evaluatorId = req.user?.id || req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        throw new AppError('Invalid submission ID format.', 400);
      }

      const submission = await AssignmentSubmission.findById(submissionId);
      if (!submission) {
        throw new AppError('Submission record not found.', 404);
      }

      const numericGrade = parseFloat(grade);
      if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > submission.maxMarks) {
        throw new AppError(`Grade must be a number between 0 and ${submission.maxMarks}.`, 400);
      }

      submission.grade = numericGrade;
      submission.feedback = feedback ? feedback.trim() : '';
      submission.status = status || 'GRADED';
      submission.gradedBy = evaluatorId;
      submission.gradedAt = new Date();
      await submission.save();

      await recordAudit(req, {
        action: 'GRADE_SUBMISSION',
        entity: 'AssignmentSubmission',
        entityId: submissionId,
        newValue: submission
      });

      return res.status(200).json({
        success: true,
        message: 'Submission graded successfully.',
        data: submission
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/lms/upload
   * File Upload Endpoint for LMS materials (PDF, Video, Docs)
   */
  uploadLmsFile: async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('No file attached to upload request.', 400);
      }

      let resultUrl = '';
      let publicId = '';

      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
          resultUrl = result.secure_url || result.url;
          publicId = result.public_id;
        } catch (cloudErr) {
          console.warn("Cloudinary upload failed, falling back to data URL:", cloudErr.message);
          const base64 = req.file.buffer.toString('base64');
          resultUrl = `data:${req.file.mimetype};base64,${base64}`;
        }
      } else {
        // Fallback for environment without Cloudinary setup
        const base64 = req.file.buffer.toString('base64');
        resultUrl = `data:${req.file.mimetype};base64,${base64}`;
      }

      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully.',
        data: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: resultUrl,
          publicId
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/student/enrolled-courses
   * Retrieve student's enrolled courses with LMS progress stats
   * Supports req.query.studentId / req.query.userId / req.query.user_id
   * Allows staff/admin overview of active course enrollments when no query param is supplied
   */
  getStudentEnrolledCourses: async (req, res, next) => {
    try {
      const queryStudentId = req.query.studentId || req.query.userId || req.query.user_id;
      const requesterId = req.user?.id || req.user?._id;
      const requesterRole = String(req.user?.role || '').toLowerCase();
      const requesterRoleId = String(req.user?.role_id || '');

      const isStudentRole = requesterRole === 'student' || requesterRoleId === '10';

      const queryFilter = {
        status: { $in: ['active', 'completed', 'paused', 'ACTIVE', 'COMPLETED', 'PAUSED'] }
      };

      if (queryStudentId && mongoose.Types.ObjectId.isValid(String(queryStudentId))) {
        queryFilter.studentId = queryStudentId;
      } else if (isStudentRole && requesterId && mongoose.Types.ObjectId.isValid(String(requesterId))) {
        queryFilter.studentId = requesterId;
      }

      const enrollments = await Enrollment.find(queryFilter)
        .populate('courseId', 'courseName courseCode category shortDescription description durationValue durationUnit syllabus status')
        .populate('batchId', 'batchName batchCode startDate endDate startTime endTime status')
        .sort({ updatedAt: -1 })
        .lean();

      // Deduplicate courses if staff overview returns multiple student enrollments for same course
      const seenCourseIds = new Set();

      const coursesWithStats = await Promise.all(
        enrollments.map(async (en) => {
          const courseObj = en.courseId || {};
          const courseId = courseObj._id || courseObj.id || en.courseId;
          const stId = en.studentId?._id || en.studentId || requesterId;

          if (!courseId) return null;

          const courseKey = String(courseId);

          // If no specific student filter was passed by staff, show unique enrolled courses in LMS catalog
          if (!queryStudentId && !isStudentRole) {
            if (seenCourseIds.has(courseKey)) return null;
            seenCourseIds.add(courseKey);
          }

          const validStId = stId && mongoose.Types.ObjectId.isValid(String(stId)) ? stId : null;
          const validCourseId = courseId && mongoose.Types.ObjectId.isValid(String(courseId)) ? courseId : null;

          const totalPublishedLessons = validCourseId ? await Lesson.countDocuments({ courseId: validCourseId, isPublished: true }) : 0;
          const completedCount = (validStId && validCourseId) ? await LessonProgress.countDocuments({ studentId: validStId, courseId: validCourseId }) : 0;
          const assignmentsCount = validCourseId ? await Assignment.countDocuments({ courseId: validCourseId, isPublished: true }) : 0;
          const submissions = (validStId && validCourseId) ? await AssignmentSubmission.find({ studentId: validStId, courseId: validCourseId }).lean() : [];
          const gradedSubmissions = submissions.filter(s => s.status === 'GRADED');
          
          let avgGradePercent = 0;
          if (gradedSubmissions.length > 0) {
            const sumPct = gradedSubmissions.reduce((acc, curr) => {
              const max = Number(curr.maxMarks) || 100;
              const grade = Number(curr.grade) || 0;
              return acc + ((grade / max) * 100);
            }, 0);
            avgGradePercent = Math.round(sumPct / gradedSubmissions.length) || 0;
          }

          return {
            enrollmentId: en._id,
            status: (en.status || 'ACTIVE').toUpperCase(),
            enrolledAt: en.enrolledAt || en.createdAt,
            progressPercentage: en.progressPercentage || 0,
            course: en.courseId,
            batch: en.batchId,
            lmsStats: {
              totalPublishedLessons,
              completedLessons: completedCount,
              totalAssignments: assignmentsCount,
              submittedAssignmentsCount: submissions.length,
              gradedAssignmentsCount: gradedSubmissions.length,
              averageGradePercent: avgGradePercent
            }
          };
        })
      );

      const validList = coursesWithStats.filter(Boolean);

      return res.status(200).json({
        success: true,
        data: validList
      });
    } catch (error) {
      next(error);
    }
  }
};

export default lmsController;
