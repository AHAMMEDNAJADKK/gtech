import mongoose from 'mongoose';
import Enrollment from '../models/enrollment.model.js';
import Batch from '../models/batch.model.js';
import Course from '../models/course.model.js';
import User from '../models/user.model.js';
import StudentAttendance from '../models/studentattendance.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAudit } from '../middleware/audit.middleware.js';

export const enrollmentController = {

  /**
   * GET /api/v1/academy/enrollments
   */
  getEnrollments: async (req, res, next) => {
    try {
      const { search, courseId, batchId, status, page = 1, limit = 50 } = req.query;
      const query = {};

      if (courseId && courseId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(courseId)) {
          query.courseId = courseId;
        }
      }

      if (batchId && batchId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(batchId)) {
          query.batchId = batchId;
        }
      }

      if (status && status !== 'ALL') {
        query.status = status;
      }

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      // First, purge any orphaned or deleted student enrollments
      try {
        const allEnrollments = await Enrollment.find(query).select('_id studentId').lean();
        const studentIdsToCheck = allEnrollments.map(e => e.studentId).filter(Boolean);
        const existingUsers = await User.find({ _id: { $in: studentIdsToCheck } }).select('_id status isActive isDeleted is_deleted').lean();
        const Student = (await import('../models/student.js')).default;
        
        let validStudentIdsSet = new Set();
        existingUsers.forEach(u => {
          const isDeleted = u.isDeleted === true || u.is_deleted === true || u.status === 'deleted' || u.status === 'inactive' || u.isActive === false;
          if (!isDeleted) {
            validStudentIdsSet.add(String(u._id));
          }
        });

        if (Student) {
          const existingStudents = await Student.find({ _id: { $in: studentIdsToCheck } }).select('_id status isDeleted is_deleted').lean();
          existingStudents.forEach(s => {
            const isDeleted = s.isDeleted === true || s.is_deleted === true || s.status === 'deleted' || s.status === 'inactive';
            if (!isDeleted) {
              validStudentIdsSet.add(String(s._id));
            }
          });
        }

        const invalidOrphanedIds = allEnrollments
          .filter(e => !e.studentId || !validStudentIdsSet.has(String(e.studentId)))
          .map(e => e._id);

        if (invalidOrphanedIds.length > 0) {
          await Enrollment.deleteMany({ _id: { $in: invalidOrphanedIds } });
        }
      } catch (cleanErr) {
        console.warn('Orphaned enrollment purge warning:', cleanErr.message);
      }

      // Populate enrollment with student, course, batch
      let allValidEnrollments = await Enrollment.find(query)
        .populate('studentId', 'name email phone studentId profile_image coursePreference status isDeleted is_deleted isActive')
        .populate('courseId', 'courseName courseCode category syllabus')
        .populate('batchId', 'batchName batchCode status')
        .sort({ createdAt: -1 })
        .lean();

      // Ensure deleted or missing student enrollments are strictly excluded
      allValidEnrollments = allValidEnrollments.filter(e => {
        if (!e.studentId) return false;
        const st = e.studentId;
        if (!st._id && !st.name) return false;
        if (st.isDeleted === true || st.is_deleted === true || st.status === 'deleted' || st.status === 'inactive' || st.isActive === false) return false;
        return true;
      });

      // Apply search filter if search query present
      if (search) {
        const q = search.toLowerCase().trim();
        allValidEnrollments = allValidEnrollments.filter(e => {
          const student = e.studentId || {};
          const batch = e.batchId || {};
          const course = e.courseId || {};

          const name = (student.name || '').toLowerCase();
          const email = (student.email || '').toLowerCase();
          const stId = (student.studentId || '').toLowerCase();
          const bName = (batch.batchName || '').toLowerCase();
          const cName = (course.courseName || '').toLowerCase();

          return name.includes(q) || email.includes(q) || stId.includes(q) || bName.includes(q) || cName.includes(q);
        });
      }

      const totalValid = allValidEnrollments.length;
      const paginatedEnrollments = allValidEnrollments.slice(skip, skip + limitNum);

      // Calculate attendance summaries for returned enrollments using existing StudentAttendance
      const enrichedEnrollments = await Promise.all(
        paginatedEnrollments.map(async (e) => {
          const stId = e.studentId?._id || e.studentId;
          let attendanceSummary = { totalSessions: 0, presentCount: 0, absentCount: 0, lateCount: 0, attendancePercentage: 0 };

          if (stId) {
            const attRecords = await StudentAttendance.find({ user_id: String(stId) }).lean();
            const total = attRecords.length;
            const present = attRecords.filter(r => r.status?.toUpperCase() === 'PRESENT').length;
            const absent = attRecords.filter(r => r.status?.toUpperCase() === 'ABSENT').length;
            const late = attRecords.filter(r => r.status?.toUpperCase() === 'LATE').length;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

            attendanceSummary = {
              totalSessions: total,
              presentCount: present,
              absentCount: absent,
              lateCount: late,
              attendancePercentage: percentage
            };
          }

          return {
            ...e,
            attendanceSummary
          };
        })
      );

      // Aggregate high-level metrics summary for active valid enrollments
      const totalEnrollments = totalValid;
      const activeCount = allValidEnrollments.filter(e => e.status === 'active').length;
      const completedCount = allValidEnrollments.filter(e => e.status === 'completed').length;
      const avgProgress = totalEnrollments > 0
        ? Math.round(allValidEnrollments.reduce((acc, e) => acc + (e.progressPercentage || 0), 0) / totalEnrollments)
        : 0;

      return res.status(200).json({
        success: true,
        data: enrichedEnrollments,
        stats: {
          totalEnrollments,
          activeCount,
          completedCount,
          avgProgress
        },
        pagination: {
          total: totalValid,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalValid / limitNum) || 1
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/enrollments/:id
   */
  getEnrollmentById: async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid enrollment ID format provided.', 400);
      }

      const enrollment = await Enrollment.findById(id)
        .populate('studentId', 'name email phone studentId profile_image coursePreference status qualification institution isDeleted is_deleted isActive')
        .populate('courseId')
        .populate('batchId')
        .lean();

      if (!enrollment || !enrollment.studentId) {
        throw new AppError('Enrollment record not found.', 404);
      }

      const stObj = enrollment.studentId;
      if (stObj.isDeleted === true || stObj.is_deleted === true || stObj.status === 'deleted' || stObj.status === 'inactive' || stObj.isActive === false) {
        // Clean up orphaned enrollment
        await Enrollment.findByIdAndDelete(id);
        throw new AppError('Enrollment record not found for deleted or inactive student.', 404);
      }

      // Query existing StudentAttendance data for student
      const stId = enrollment.studentId?._id || enrollment.studentId;
      const cId = enrollment.courseId?._id || enrollment.courseId;

      const attRecords = await StudentAttendance.find({ user_id: String(stId) }).lean();
      const total = attRecords.length;
      const present = attRecords.filter(r => r.status?.toUpperCase() === 'PRESENT').length;
      const absent = attRecords.filter(r => r.status?.toUpperCase() === 'ABSENT').length;
      const late = attRecords.filter(r => r.status?.toUpperCase() === 'LATE').length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      const attendanceSummary = {
        totalSessions: total,
        presentCount: present,
        absentCount: absent,
        lateCount: late,
        attendancePercentage: percentage,
        records: attRecords
      };

      // Query LMS Metrics for student & course
      let lmsSummary = {
        totalPublishedLessons: 0,
        completedLessonsCount: 0,
        totalAssignments: 0,
        submittedAssignmentsCount: 0,
        gradedAssignmentsCount: 0,
        averageGradePercentage: 0
      };

      try {
        const Lesson = (await import('../models/lesson.model.js')).default;
        const LessonProgress = (await import('../models/lessonProgress.model.js')).default;
        const Assignment = (await import('../models/assignment.model.js')).default;
        const AssignmentSubmission = (await import('../models/assignmentSubmission.model.js')).default;

        if (Lesson && cId) {
          const totalPublishedLessons = await Lesson.countDocuments({ courseId: cId, isPublished: true });
          const completedLessonsCount = await LessonProgress.countDocuments({ studentId: stId, courseId: cId });
          const totalAssignments = await Assignment.countDocuments({ courseId: cId, isPublished: true });
          const submissions = await AssignmentSubmission.find({ studentId: stId, courseId: cId }).lean();
          const gradedSubmissions = submissions.filter(s => s.status === 'GRADED');
          
          let avgGradePct = 0;
          if (gradedSubmissions.length > 0) {
            const sumPct = gradedSubmissions.reduce((acc, curr) => acc + ((curr.grade / curr.maxMarks) * 100), 0);
            avgGradePct = Math.round(sumPct / gradedSubmissions.length);
          }

          lmsSummary = {
            totalPublishedLessons,
            completedLessonsCount,
            totalAssignments,
            submittedAssignmentsCount: submissions.length,
            gradedAssignmentsCount: gradedSubmissions.length,
            averageGradePercentage: avgGradePct
          };
        }
      } catch (lmsErr) {
        console.warn("LMS Summary lookup fallback:", lmsErr.message);
      }

      return res.status(200).json({
        success: true,
        data: {
          ...enrollment,
          attendanceSummary,
          lmsSummary
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/enrollments
   */
  createEnrollment: async (req, res, next) => {
    try {
      const { studentId, batchId, status } = req.body;

      if (!studentId) {
        throw new AppError('Student selection is required for enrollment.', 400);
      }

      if (!batchId) {
        throw new AppError('Batch selection is required for enrollment.', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        throw new AppError('Invalid student ID format provided.', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        throw new AppError('Invalid batch ID format provided.', 400);
      }

      // 1. Verify registered student exists
      const studentObj = await User.findById(studentId);
      if (!studentObj) {
        throw new AppError('Selected student was not found in registered accounts.', 404);
      }

      // 2. Verify batch exists
      const batchObj = await Batch.findById(batchId).populate('courseId');
      if (!batchObj) {
        throw new AppError('Selected batch was not found.', 404);
      }

      // 3. Derive Course from Batch
      const courseObj = batchObj.courseId;
      if (!courseObj) {
        throw new AppError('Batch course could not be determined.', 400);
      }
      const courseId = courseObj._id || courseObj;

      // 4. Verify student is assigned to batch.students
      const batchStudents = (batchObj.students || []).map(s => String(s));
      if (!batchStudents.includes(String(studentId))) {
        // Auto-add student to batch.students to maintain consistency
        batchObj.students.push(studentId);
        await batchObj.save();
      }

      // 5. Prevent duplicate active enrollment for same Student + Batch
      const existingEnrollment = await Enrollment.findOne({
        studentId,
        batchId,
        status: { $in: ['active', 'paused'] }
      });

      if (existingEnrollment) {
        throw new AppError(`Student '${studentObj.name}' is already actively enrolled in '${batchObj.batchName}'.`, 409);
      }

      // Derive total modules count from course syllabus if present, default 10
      const syllabusModules = Array.isArray(courseObj.syllabus) ? courseObj.syllabus.length : 0;
      const totalModules = syllabusModules > 0 ? syllabusModules : 10;

      const newEnrollment = await Enrollment.create({
        studentId,
        courseId,
        batchId,
        status: status || 'active',
        totalModules,
        completedModules: 0,
        progressPercentage: 0,
        enrolledAt: new Date(),
        createdBy: req.user?.id || req.user?._id
      });

      await recordAudit(req, {
        action: 'CREATE',
        entity: 'Enrollment',
        entityId: newEnrollment._id,
        newValue: newEnrollment
      });

      const populatedEnrollment = await Enrollment.findById(newEnrollment._id)
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .lean();

      return res.status(201).json({
        success: true,
        message: 'Student enrolled successfully.',
        data: populatedEnrollment
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/academy/enrollments/:id/progress
   */
  updateProgress: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { completedModules, totalModules } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid enrollment ID format provided.', 400);
      }

      const enrollment = await Enrollment.findById(id);
      if (!enrollment) {
        throw new AppError('Enrollment record not found.', 404);
      }

      const parsedTotal = parseInt(totalModules, 10) || enrollment.totalModules || 10;
      const parsedCompleted = parseInt(completedModules, 10);

      if (isNaN(parsedCompleted) || parsedCompleted < 0) {
        throw new AppError('Completed modules value must be a non-negative number.', 400);
      }

      if (parsedCompleted > parsedTotal) {
        throw new AppError(`Completed modules (${parsedCompleted}) cannot exceed total modules (${parsedTotal}).`, 400);
      }

      const progressPercentage = Math.round((parsedCompleted / parsedTotal) * 100);

      const oldValue = enrollment.toObject();
      enrollment.completedModules = parsedCompleted;
      enrollment.totalModules = parsedTotal;
      enrollment.progressPercentage = progressPercentage;
      enrollment.lastActivityAt = new Date();

      if (progressPercentage === 100 && enrollment.status !== 'completed') {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
      }

      enrollment.updatedBy = req.user?.id || req.user?._id;
      await enrollment.save();

      await recordAudit(req, {
        action: 'UPDATE_PROGRESS',
        entity: 'Enrollment',
        entityId: id,
        oldValue,
        newValue: enrollment
      });

      const updatedEnrollment = await Enrollment.findById(id)
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .lean();

      return res.status(200).json({
        success: true,
        message: 'Enrollment progress updated successfully.',
        data: updatedEnrollment
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/academy/enrollments/:id/status
   */
  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid enrollment ID format provided.', 400);
      }

      const validStatuses = ['active', 'paused', 'completed', 'dropped'];
      if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      const enrollment = await Enrollment.findById(id);
      if (!enrollment) {
        throw new AppError('Enrollment record not found.', 404);
      }

      const oldValue = enrollment.toObject();
      enrollment.status = status;
      if (status === 'completed' && !enrollment.completedAt) {
        enrollment.completedAt = new Date();
      }
      enrollment.updatedBy = req.user?.id || req.user?._id;
      await enrollment.save();

      await recordAudit(req, {
        action: 'UPDATE_STATUS',
        entity: 'Enrollment',
        entityId: id,
        oldValue,
        newValue: enrollment
      });

      return res.status(200).json({
        success: true,
        message: `Enrollment status updated to '${status}'.`,
        data: enrollment
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/academy/enrollments/:id
   */
  deleteEnrollment: async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid enrollment ID format provided.', 400);
      }

      const enrollment = await Enrollment.findById(id);
      if (!enrollment) {
        throw new AppError('Enrollment record not found.', 404);
      }

      const oldValue = enrollment.toObject();
      await enrollment.deleteOne();

      await recordAudit(req, {
        action: 'DELETE',
        entity: 'Enrollment',
        entityId: id,
        oldValue
      });

      return res.status(200).json({
        success: true,
        message: 'Enrollment record deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
};

export default enrollmentController;
