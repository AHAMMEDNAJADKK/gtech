import mongoose from 'mongoose';
import Course from '../models/course.model.js';
import Enrollment from '../models/enrollment.model.js';
import Lesson from '../models/lesson.model.js';
import LessonProgress from '../models/lessonProgress.model.js';
import Assignment from '../models/assignment.model.js';
import AssignmentSubmission from '../models/assignmentSubmission.model.js';
import User from '../models/user.model.js';
import Batch from '../models/batch.model.js';
import { getAuthUserContext } from '../utils/rbac.helper.js';
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
   * GET /api/v1/academy/assignments
   * Get all assignments with role-based scoping and filters
   */
  getAllAssignments: async (req, res, next) => {
    try {
      const { courseId, batchId, status } = req.query;
      const auth = await getAuthUserContext(req);
      const query = {};

      if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(courseId)) {
        query.courseId = courseId;
      }
      if (batchId && batchId !== 'ALL' && mongoose.Types.ObjectId.isValid(batchId)) {
        query.batchId = batchId;
      }
      if (status && status !== 'ALL') {
        if (status === 'PUBLISHED') query.isPublished = true;
        else if (status === 'DRAFT') query.isPublished = false;
        else query.status = status;
      }

      // Role Scoping
      if (auth.isStudent) {
        // Students only see published assignments for their enrolled courses/batches
        query.isPublished = true;
        const studentEnrollments = await Enrollment.find({
          studentId: auth.userId,
          status: { $in: ['active', 'completed', 'paused', 'ACTIVE', 'COMPLETED', 'PAUSED'] }
        }).select('courseId batchId').lean();

        const enrolledCourseIds = studentEnrollments.map(e => e.courseId).filter(Boolean);
        const enrolledBatchIds = studentEnrollments.map(e => e.batchId).filter(Boolean);

        const studentIdObj = new mongoose.Types.ObjectId(auth.userId);
        query.$or = [
          { targetType: 'ALL' },
          { courseId: { $in: enrolledCourseIds } },
          { batchId: { $in: enrolledBatchIds } },
          { targetStudents: studentIdObj }
        ];
      } else if (auth.isInstructor && !auth.isSuperAdmin && !auth.isHr) {
        // Mentors only see assignments for courses or batches they teach, or created by them
        const mentorUserObj = new mongoose.Types.ObjectId(auth.userId);
        const taughtBatches = await Batch.find({
          $or: [
            { instructorId: mentorUserObj },
            { instructors: mentorUserObj }
          ]
        }).select('_id courseId').lean();

        const mentorBatchIds = taughtBatches.map(b => b._id);
        const mentorCourseIds = taughtBatches.map(b => b.courseId).filter(Boolean);

        const taughtCourses = await Course.find({
          $or: [
            { instructorId: mentorUserObj },
            { instructor: mentorUserObj }
          ]
        }).select('_id').lean();
        taughtCourses.forEach(c => {
          if (!mentorCourseIds.some(id => String(id) === String(c._id))) {
            mentorCourseIds.push(c._id);
          }
        });

        query.$or = [
          { createdBy: mentorUserObj },
          { assignedMentor: mentorUserObj },
          { batchId: { $in: mentorBatchIds } },
          { courseId: { $in: mentorCourseIds } }
        ];
      }

      const assignments = await Assignment.find(query)
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('assignedMentor', 'name email employeeId profile_image')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      // If student requester: attach individual submission status
      if (auth.isStudent) {
        const studentSubs = await AssignmentSubmission.find({ studentId: auth.userId }).lean();
        const enriched = assignments.map(a => {
          const sub = studentSubs.find(s => String(s.assignmentId) === String(a._id));
          return {
            ...a,
            mySubmission: sub || null,
            submissionStatus: sub ? sub.status : 'NOT_STARTED'
          };
        });
        return res.status(200).json({ success: true, data: enriched });
      }

      return res.status(200).json({ success: true, data: assignments });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/assignments/:assignmentId
   */
  getAssignmentById: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId)
        .populate('courseId', 'courseName courseCode syllabus')
        .populate('batchId', 'batchName batchCode')
        .populate('assignedMentor', 'name email employeeId profile_image')
        .populate('createdBy', 'name email')
        .lean();

      if (!assignment) {
        throw new AppError('Assignment not found.', 404);
      }

      const userId = req.user?.id || req.user?._id;
      const auth = await getAuthUserContext(req);

      let mySubmission = null;
      if (auth.isStudent && userId) {
        mySubmission = await AssignmentSubmission.findOne({ assignmentId, studentId: userId }).lean();
      }

      return res.status(200).json({
        success: true,
        data: {
          ...assignment,
          mySubmission
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:courseId/assignments
   * POST /api/v1/academy/assignments
   * Create and distribute assignment (Super Admin, HR, Mentor)
   */
  createAssignment: async (req, res, next) => {
    try {
      const courseId = req.params.courseId || req.body.courseId;
      const { 
        moduleId, title, description, instructions, attachmentUrl, 
        maxMarks, dueDate, allowedSubmissionTypes, allowedFileFormats,
        maxFileSize, batchId, assignedMentor, targetType = 'ALL',
        targetStudents = [], isPublished = true, status
      } = req.body;

      if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
        throw new AppError('Valid course ID is required.', 400);
      }

      if (!title || !title.trim()) {
        throw new AppError('Assignment title is required.', 400);
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const rawMarks = maxMarks ?? req.body.maxScore ?? req.body.maximumMarks ?? 100;
      const parsedMaxMarks = parseInt(rawMarks, 10);
      if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
        throw new AppError('Maximum marks must be a positive number greater than 0.', 400);
      }

      const finalPublished = isPublished !== undefined ? Boolean(isPublished) : (status === 'PUBLISHED');
      const finalStatus = finalPublished ? 'PUBLISHED' : 'DRAFT';
      const creatorId = req.user?.id || req.user?._id;
      const resolvedMentor = assignedMentor || (req.user?.role === 'mentor' || req.user?.role === 'instructor' ? creatorId : null);

      const newAssignment = await Assignment.create({
        courseId,
        batchId: batchId && mongoose.Types.ObjectId.isValid(batchId) ? batchId : null,
        assignedMentor: resolvedMentor && mongoose.Types.ObjectId.isValid(resolvedMentor) ? resolvedMentor : null,
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
        allowedFileFormats: Array.isArray(allowedFileFormats) && allowedFileFormats.length > 0
          ? allowedFileFormats
          : ['pdf', 'jpg', 'jpeg', 'png'],
        maxFileSize: maxFileSize && Number(maxFileSize) > 0 ? Number(maxFileSize) : 10485760, // 10MB default
        targetType: targetType || (batchId ? 'BATCH' : 'ALL'),
        targetStudents: Array.isArray(targetStudents) ? targetStudents : [],
        isPublished: finalPublished,
        status: finalStatus,
        createdBy: creatorId
      });

      // Assignment distribution: Ensure recipient students have initial submission records
      try {
        let recipientStudentIds = [];
        if (targetType === 'STUDENTS' && Array.isArray(targetStudents) && targetStudents.length > 0) {
          recipientStudentIds = targetStudents;
        } else if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
          const batchDoc = await Batch.findById(batchId).select('students');
          if (batchDoc && Array.isArray(batchDoc.students)) {
            recipientStudentIds = batchDoc.students;
          }
        }

        if (recipientStudentIds.length > 0 && finalPublished) {
          const ops = recipientStudentIds.map(stId => ({
            updateOne: {
              filter: { assignmentId: newAssignment._id, studentId: stId },
              update: {
                $setOnInsert: {
                  assignmentId: newAssignment._id,
                  studentId: stId,
                  courseId,
                  batchId: batchId || null,
                  maxMarks: parsedMaxMarks,
                  status: 'NOT_STARTED'
                }
              },
              upsert: true
            }
          }));
          await AssignmentSubmission.bulkWrite(ops);
        }
      } catch (distErr) {
        console.warn('Assignment distribution non-blocking error:', distErr.message);
      }

      await recordAudit(req, {
        action: 'CREATE_ASSIGNMENT',
        entity: 'Assignment',
        entityId: newAssignment._id,
        newValue: newAssignment
      });

      return res.status(201).json({
        success: true,
        message: 'Assignment created and distributed successfully.',
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
        'dueDate', 'allowedSubmissionTypes', 'allowedFileFormats',
        'maxFileSize', 'isPublished', 'status', 'moduleId', 'lessonId',
        'batchId', 'assignedMentor', 'targetType', 'targetStudents', 'attachmentUrl'
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

      if (req.body.isPublished !== undefined) {
        assignment.isPublished = Boolean(req.body.isPublished);
        assignment.status = assignment.isPublished ? 'PUBLISHED' : 'DRAFT';
      }

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
   * Enrolled student submits solution to assignment (PDF / Image / Text)
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

      if (assignment.isPublished === false || assignment.status === 'DRAFT') {
        throw new AppError('Assignment is in draft mode and not accepting submissions.', 403);
      }

      // Look up student's enrollment
      const enrollment = await Enrollment.findOne({
        studentId,
        courseId: assignment.courseId,
        status: { $in: ['active', 'completed', 'paused', 'ACTIVE', 'COMPLETED', 'PAUSED'] }
      });

      const actualFileUrl = (fileUrl || req.body.submissionUrl || '').trim();
      const actualTextAnswer = (textAnswer || req.body.submissionText || req.body.content || '').trim();
      const actualExternalUrl = (externalUrl || req.body.link || req.body.githubUrl || '').trim();
      const determinedType = submissionType || (actualFileUrl ? 'FILE' : (actualExternalUrl ? 'LINK' : 'TEXT'));

      if (determinedType === 'FILE') {
        if (!actualFileUrl) {
          throw new AppError('Please attach a PDF or image file for this submission.', 400);
        }

        // File format validation
        const allowedExtensions = assignment.allowedFileFormats?.length > 0
          ? assignment.allowedFileFormats.map(ext => ext.toLowerCase().replace(/^\./, ''))
          : ['pdf', 'jpg', 'jpeg', 'png'];

        const rawFileName = fileMetadata?.originalName || actualFileUrl;
        const fileExtMatch = rawFileName.match(/\.([a-zA-Z0-9]+)($|\?)/);
        const fileExt = fileExtMatch ? fileExtMatch[1].toLowerCase() : '';

        // If file extension is identifiable, check against allowed extensions
        if (fileExt && !allowedExtensions.includes(fileExt) && !actualFileUrl.startsWith('data:image/')) {
          throw new AppError(`Allowed file formats: ${allowedExtensions.join(', ').toUpperCase()}. Found .${fileExt}`, 400);
        }

        // File size validation (default 10MB)
        const maxBytes = assignment.maxFileSize || 10485760;
        if (fileMetadata?.size && fileMetadata.size > maxBytes) {
          const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
          throw new AppError(`File exceeds maximum allowed size of ${maxMB}MB.`, 400);
        }
      }

      // Check deadline for late submission indicator
      const now = new Date();
      const isLate = assignment.dueDate ? now > new Date(assignment.dueDate) : false;

      // Existing submission check (to handle resubmission)
      const existingSub = await AssignmentSubmission.findOne({ assignmentId, studentId });
      const isResubmission = existingSub && existingSub.status === 'RESUBMISSION_REQUIRED';

      const updateData = {
        assignmentId,
        studentId,
        courseId: assignment.courseId,
        batchId: assignment.batchId || enrollment?.batchId || null,
        enrollmentId: enrollment?._id || null,
        submissionType: determinedType,
        fileUrl: actualFileUrl,
        fileMetadata: fileMetadata || (existingSub?.fileMetadata || {}),
        textAnswer: actualTextAnswer,
        externalUrl: actualExternalUrl,
        submittedAt: now,
        isLate,
        status: 'SUBMITTED',
        maxMarks: assignment.maxMarks
      };

      if (isResubmission) {
        updateData.resubmittedAt = now;
      }

      const submission = await AssignmentSubmission.findOneAndUpdate(
        { assignmentId, studentId },
        { $set: updateData },
        { upsert: true, new: true }
      );

      return res.status(201).json({
        success: true,
        message: isLate ? 'Assignment submitted (Late Submission recorded).' : 'Assignment submitted successfully!',
        data: submission
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/my-submissions
   * Logged-in student queries all their submissions with grades & feedback
   */
  getMySubmissions: async (req, res, next) => {
    try {
      const studentId = req.user?.id || req.user?._id;
      if (!studentId) {
        throw new AppError('Authentication required.', 401);
      }

      const submissions = await AssignmentSubmission.find({ studentId })
        .populate({
          path: 'assignmentId',
          select: 'title description instructions dueDate maxMarks allowedFileFormats status'
        })
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('gradedBy', 'name email designation')
        .sort({ submittedAt: -1, createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: submissions
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/grading/submissions
   * HR and Mentors fetch submissions requiring evaluation
   */
  getGradingQueue: async (req, res, next) => {
    try {
      const { courseId, batchId, status, search } = req.query;
      const auth = await getAuthUserContext(req);
      const query = { status: { $ne: 'NOT_STARTED' } };

      if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(courseId)) {
        query.courseId = courseId;
      }
      if (batchId && batchId !== 'ALL' && mongoose.Types.ObjectId.isValid(batchId)) {
        query.batchId = batchId;
      }
      if (status && status !== 'ALL') {
        query.status = status;
      }

      // Mentor Scoping
      if (auth.isInstructor && !auth.isSuperAdmin && !auth.isHr) {
        const mentorUserObj = new mongoose.Types.ObjectId(auth.userId);
        const taughtBatches = await Batch.find({
          $or: [{ instructorId: mentorUserObj }, { instructors: mentorUserObj }]
        }).select('_id courseId').lean();

        const mentorBatchIds = taughtBatches.map(b => b._id);
        const mentorCourseIds = taughtBatches.map(b => b.courseId).filter(Boolean);

        query.$or = [
          { batchId: { $in: mentorBatchIds } },
          { courseId: { $in: mentorCourseIds } }
        ];
      }

      const submissions = await AssignmentSubmission.find(query)
        .populate('assignmentId', 'title maxMarks dueDate instructions')
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('gradedBy', 'name email')
        .sort({ submittedAt: -1 })
        .lean();

      let filtered = submissions;
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        filtered = submissions.filter(s => 
          s.studentId?.name?.toLowerCase().includes(term) ||
          s.studentId?.studentId?.toLowerCase().includes(term) ||
          s.studentId?.email?.toLowerCase().includes(term) ||
          s.assignmentId?.title?.toLowerCase().includes(term)
        );
      }

      return res.status(200).json({
        success: true,
        data: filtered
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/assignments/:assignmentId/submissions
   * Instructor/Admin fetches student submissions for a specific assignment
   */
  getAssignmentSubmissions: async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new AppError('Invalid assignment ID format.', 400);
      }

      const assignment = await Assignment.findById(assignmentId)
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('assignedMentor', 'name email employeeId')
        .lean();

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
   * Reviewer grades student submission, adds marks & feedback, or requests resubmission
   */
  gradeSubmission: async (req, res, next) => {
    try {
      const { submissionId } = req.params;
      const { grade, score, marks, feedback, status, resubmissionReason } = req.body;
      const evaluatorId = req.user?.id || req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        throw new AppError('Invalid submission ID format.', 400);
      }

      const submission = await AssignmentSubmission.findById(submissionId).populate('assignmentId');
      if (!submission) {
        throw new AppError('Submission record not found.', 404);
      }

      const targetStatus = status || 'GRADED';

      if (targetStatus === 'RESUBMISSION_REQUIRED') {
        const reason = (resubmissionReason || feedback || '').trim();
        if (!reason) {
          throw new AppError('Please provide a reason or correction instructions when requesting resubmission.', 400);
        }
        submission.status = 'RESUBMISSION_REQUIRED';
        submission.resubmissionReason = reason;
        submission.feedback = feedback ? feedback.trim() : reason;
      } else if (targetStatus === 'GRADED') {
        const rawGrade = grade !== undefined ? grade : (score !== undefined ? score : marks);
        if (rawGrade === undefined || rawGrade === null || rawGrade === '') {
          throw new AppError('Marks or grade is required to publish evaluation.', 400);
        }
        const numericGrade = parseFloat(rawGrade);
        const maxMarks = submission.maxMarks || submission.assignmentId?.maxMarks || 100;
        if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > maxMarks) {
          throw new AppError(`Grade must be a valid number between 0 and ${maxMarks}.`, 400);
        }

        submission.grade = numericGrade;
        submission.status = 'GRADED';
        submission.feedback = feedback ? feedback.trim() : '';
      } else if (targetStatus === 'UNDER_REVIEW') {
        submission.status = 'UNDER_REVIEW';
        if (feedback) submission.feedback = feedback.trim();
      }

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
        message: targetStatus === 'RESUBMISSION_REQUIRED' 
          ? 'Resubmission requested from student.' 
          : 'Submission graded successfully.',
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
