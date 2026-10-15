import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import User from '../models/user.model.js';
import Enrollment from '../models/enrollment.model.js';
import Counter from '../models/counter.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAudit } from '../middleware/audit.middleware.js';
import { generateSyllabusPdfBuffer } from '../utils/syllabusPdfGenerator.js';
import { uploadToCloudinary } from '../utils/cloudinary.util.js';

const generateCourseCode = async () => {
  const year = new Date().getFullYear();
  const counterId = `course_${year}`;
  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const sequenceStr = String(counter.seq).padStart(6, '0');
  return `CRS-${year}-${sequenceStr}`;
};

export const courseController = {
  
  /**
   * GET /api/v1/academy/courses
   * Search, filter, paginate courses & return summary stats
   */
  getCourses: async (req, res, next) => {
    try {
      const { search, category, status, page = 1, limit = 50 } = req.query;
      const query = {};

      if (search) {
        const safeSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { courseName: { $regex: safeSearch, $options: 'i' } },
          { courseCode: { $regex: safeSearch, $options: 'i' } },
          { shortDescription: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      if (category && category !== 'ALL') {
        query.category = category;
      }

      if (status && status !== 'ALL') {
        query.status = status;
      }

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const [courses, total, stats, batches] = await Promise.all([
        Course.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Course.countDocuments(query),
        Course.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        Batch.aggregate([
          {
            $group: {
              _id: '$courseId',
              batchCount: { $sum: 1 }
            }
          }
        ])
      ]);

      const batchCountMap = {};
      batches.forEach(b => {
        batchCountMap[String(b._id)] = b.batchCount;
      });

      const coursesWithBatchCount = courses.map(c => ({
        ...c,
        batchCount: batchCountMap[String(c._id)] || 0
      }));

      const statMap = { total, ACTIVE: 0, ARCHIVED: 0, DRAFT: 0, INACTIVE: 0 };
      stats.forEach(s => {
        if (s._id) statMap[s._id] = s.count;
      });

      return res.status(200).json({
        success: true,
        data: coursesWithBatchCount,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1
        },
        stats: {
          totalCourses: total,
          activeCourses: statMap.ACTIVE || 0,
          archivedCourses: statMap.ARCHIVED || 0,
          draftCourses: statMap.DRAFT || 0
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/courses/:id
   * Get single course details with related batches
   */
  getCourseById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const targetIdStr = (id || '').trim();

      if (!targetIdStr || targetIdStr === 'undefined' || targetIdStr === 'null') {
        throw new AppError('Invalid or missing course identifier.', 400);
      }

      let course = null;
      if (mongoose.Types.ObjectId.isValid(targetIdStr)) {
        course = await Course.findById(targetIdStr).lean();
      }

      if (!course) {
        course = await Course.findOne({
          $or: [
            { courseCode: targetIdStr },
            { slug: targetIdStr.toLowerCase() }
          ]
        }).lean();
      }

      if (!course) {
        console.warn(`[COURSE_NOT_FOUND] Requested ID: ${targetIdStr}, Authenticated User: ${req.user?.id || req.user?._id || 'anonymous'}`);
        throw new AppError('Course record not found.', 404);
      }

      console.log(`[COURSE_LOOKUP_SUCCESS] Requested ID: ${targetIdStr}, Found Course: ${course.courseCode} (${course._id}), User: ${req.user?.id || req.user?._id || 'anonymous'}`);

      let batches = [];
      try {
        batches = await Batch.find({ courseId: course._id })
          .populate('instructorId', 'name email phone role profile_image avatar')
          .sort({ startDate: -1 })
          .lean();
      } catch (batchErr) {
        console.error(`[COURSE_BATCH_POPULATE_ERROR] Failed fetching batches for course ${course._id}:`, batchErr.message);
      }

      return res.status(200).json({
        success: true,
        data: {
          ...course,
          batches
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses
   * Create a new course
   */
  createCourse: async (req, res, next) => {
    try {
      const {
        courseCode,
        courseName,
        category,
        shortDescription,
        description,
        durationValue,
        durationUnit,
        courseFee,
        status,
        syllabus
      } = req.body;

      if (!courseName) {
        throw new AppError('Course name is required.', 400);
      }

      let finalCode = (courseCode || '').trim();
      if (!finalCode) {
        finalCode = await generateCourseCode();
      } else {
        const existing = await Course.findOne({ courseCode: finalCode });
        if (existing) {
          throw new AppError(`Course code '${finalCode}' is already in use.`, 409);
        }
      }

      const slug = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const newCourse = await Course.create({
        courseCode: finalCode,
        courseName: courseName.trim(),
        slug,
        category: category || 'Web Development',
        shortDescription: shortDescription || '',
        description: description || '',
        durationValue: parseInt(durationValue, 10) || 6,
        durationUnit: durationUnit || 'Months',
        courseFee: parseFloat(courseFee) || 0,
        status: status || 'ACTIVE',
        syllabus: Array.isArray(syllabus) ? syllabus : [],
        createdBy: req.user?.id || req.user?._id
      });

      await recordAudit(req, {
        action: 'CREATE',
        entity: 'Course',
        entityId: newCourse._id,
        newValue: newCourse
      });

      return res.status(201).json({
        success: true,
        message: 'Course created successfully.',
        data: newCourse
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT/PATCH /api/v1/academy/courses/:id
   * Update course details
   */
  updateCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const existingCourse = await Course.findById(id);

      if (!existingCourse) {
        throw new AppError('Course not found.', 404);
      }

      const {
        courseName,
        category,
        shortDescription,
        description,
        durationValue,
        durationUnit,
        courseFee,
        status,
        syllabus
      } = req.body;

      const oldValue = existingCourse.toObject();

      if (courseName !== undefined) {
        existingCourse.courseName = courseName.trim();
        existingCourse.slug = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      if (category !== undefined) existingCourse.category = category;
      if (shortDescription !== undefined) existingCourse.shortDescription = shortDescription;
      if (description !== undefined) existingCourse.description = description;
      if (durationValue !== undefined) existingCourse.durationValue = parseInt(durationValue, 10) || existingCourse.durationValue;
      if (durationUnit !== undefined) existingCourse.durationUnit = durationUnit;
      if (courseFee !== undefined) existingCourse.courseFee = Math.max(0, parseFloat(courseFee) || 0);
      if (status !== undefined) existingCourse.status = status;
      if (Array.isArray(syllabus)) existingCourse.syllabus = syllabus;

      existingCourse.updatedBy = req.user?.id || req.user?._id;
      await existingCourse.save();

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: existingCourse
      });

      return res.status(200).json({
        success: true,
        message: 'Course updated successfully.',
        data: existingCourse
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:id/archive
   */
  archiveCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const oldValue = course.toObject();
      course.status = 'ARCHIVED';
      course.updatedBy = req.user?.id || req.user?._id;
      await course.save();

      await recordAudit(req, {
        action: 'ARCHIVE',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: course
      });

      return res.status(200).json({
        success: true,
        message: 'Course archived successfully.',
        data: course
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:id/activate
   */
  activateCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const oldValue = course.toObject();
      course.status = 'ACTIVE';
      course.updatedBy = req.user?.id || req.user?._id;
      await course.save();

      await recordAudit(req, {
        action: 'ACTIVATE',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: course
      });

      return res.status(200).json({
        success: true,
        message: 'Course activated successfully.',
        data: course
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/academy/courses/:id/syllabus
   * Update syllabus structure specifically
   */
  updateSyllabus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { syllabus } = req.body;

      if (!Array.isArray(syllabus)) {
        throw new AppError('Syllabus must be an array of modules.', 400);
      }

      const course = await Course.findById(id);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      const oldValue = course.toObject();
      course.syllabus = syllabus;
      course.updatedBy = req.user?.id || req.user?._id;
      await course.save();

      await recordAudit(req, {
        action: 'UPDATE_SYLLABUS',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: course
      });

      return res.status(200).json({
        success: true,
        message: 'Syllabus updated successfully.',
        data: course
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/instructors
   * Retrieve eligible instructors from User collection
   */
  getEligibleInstructors: async (req, res, next) => {
    try {
      const users = await User.find({
        role_id: { $ne: '10' },
        status: { $ne: 'inactive' }
      })
      .select('_id name email phone role designation profile_image avatar')
      .sort({ name: 1 })
      .lean();

      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/academy/courses/:id
   * Delete course if no batches are attached to it
   */
  deleteCourse: async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid course ID format provided.', 400);
      }

      const course = await Course.findById(id);
      if (!course) {
        throw new AppError('Course record not found.', 404);
      }

      // Check if any batches exist for this course
      const batchCount = await Batch.countDocuments({ courseId: id });
      if (batchCount > 0) {
        throw new AppError(
          `Cannot delete course '${course.courseName}'. It has ${batchCount} batch(es) assigned to it. Remove or reassign batches first.`,
          400
        );
      }

      const oldValue = course.toObject();
      await Course.findByIdAndDelete(id);

      await recordAudit(req, {
        action: 'DELETE',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: null
      });

      return res.status(200).json({
        success: true,
        message: 'Course deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/courses/:id/syllabus
   * Retrieve course syllabus details.
   * Access: Staff or students enrolled in this course.
   */
  getCourseSyllabus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');
      const isStudent = userRole === 'student' || userRoleId === '10';

      const course = await Course.findById(id).lean();
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      if (isStudent) {
        const studentId = user.id || user._id;
        const enrolled = await Enrollment.findOne({
          studentId,
          courseId: id,
          status: { $in: ['active', 'paused', 'completed', 'ACTIVE', 'PAUSED', 'COMPLETED'] }
        });
        if (!enrolled) {
          throw new AppError('Access denied: You are not enrolled in this course.', 403);
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          course: {
            _id: course._id,
            courseName: course.courseName,
            courseCode: course.courseCode,
            category: course.category,
            durationValue: course.durationValue,
            durationUnit: course.durationUnit,
            courseFee: course.courseFee,
            description: course.description,
            shortDescription: course.shortDescription,
            status: course.status
          },
          syllabus: course.syllabus || [],
          syllabusPdf: course.syllabusPdf || null
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/courses/:id/syllabus/pdf
   * Download or preview syllabus PDF.
   * If official PDF exists, serves/redirects. Else dynamically generates publication-quality PDF via PDFKit.
   */
  downloadSyllabusPdf: async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');
      const isStudent = userRole === 'student' || userRoleId === '10';

      const course = await Course.findById(id).lean();
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      if (isStudent) {
        const studentId = user.id || user._id;
        const enrolled = await Enrollment.findOne({
          studentId,
          courseId: id,
          status: { $in: ['active', 'paused', 'completed', 'ACTIVE', 'PAUSED', 'COMPLETED'] }
        });
        if (!enrolled) {
          throw new AppError('Access denied: You are not enrolled in this course.', 403);
        }
      }

      const isPreview = String(req.query.preview || '').toLowerCase() === 'true';
      const dispositionType = isPreview ? 'inline' : 'attachment';
      const safeCourseName = String(course.courseName || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeCourseName}_Syllabus.pdf`;

      // 1. If an official uploaded PDF file exists
      if (course.syllabusPdf && course.syllabusPdf.url) {
        const fileUrl = course.syllabusPdf.url;
        if (fileUrl.startsWith('/uploads/')) {
          const localPath = path.resolve(process.cwd(), fileUrl.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `${dispositionType}; filename="${filename}"`);
            return fs.createReadStream(localPath).pipe(res);
          }
        } else if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          return res.redirect(fileUrl);
        }
      }

      // 2. Otherwise generate dynamic vector PDF using PDFKit
      const pdfBuffer = await generateSyllabusPdfBuffer(course);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${filename}"`);
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/academy/courses/:id/syllabus/upload-pdf
   * Upload an official syllabus PDF for a course (Admin & Authorized Staff only).
   */
  uploadSyllabusPdf: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        throw new AppError('Please select a PDF file to upload.', 400);
      }

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if (req.file.mimetype !== 'application/pdf' && ext !== '.pdf') {
        throw new AppError('Only official PDF documents are supported for syllabus upload.', 400);
      }

      if (req.file.size > 25 * 1024 * 1024) {
        throw new AppError('Syllabus PDF file size cannot exceed 25MB.', 400);
      }

      const course = await Course.findById(id);
      if (!course) {
        throw new AppError('Course not found.', 404);
      }

      let fileUrl = '';
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
          if (fileBuffer) {
            const result = await uploadToCloudinary(fileBuffer, req.file.originalname);
            fileUrl = result.secure_url || result.url;
          }
        } catch (err) {
          console.warn('Cloudinary syllabus upload failed, falling back to disk:', err.message);
        }
      }

      if (!fileUrl) {
        const syllabusDir = path.resolve(process.cwd(), 'uploads', 'syllabus');
        fs.mkdirSync(syllabusDir, { recursive: true });
        const safeFilename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const targetPath = path.join(syllabusDir, safeFilename);

        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.copyFileSync(req.file.path, targetPath);
        } else if (req.file.buffer) {
          fs.writeFileSync(targetPath, req.file.buffer);
        }
        fileUrl = `/uploads/syllabus/${safeFilename}`;
      }

      const oldValue = course.toObject();
      course.syllabusPdf = {
        url: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date()
      };
      course.updatedBy = req.user?.id || req.user?._id;
      await course.save();

      await recordAudit(req, {
        action: 'UPLOAD_SYLLABUS_PDF',
        entity: 'Course',
        entityId: id,
        oldValue,
        newValue: course
      });

      return res.status(200).json({
        success: true,
        message: 'Official syllabus PDF uploaded and linked successfully.',
        data: {
          courseId: course._id,
          syllabusPdf: course.syllabusPdf
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/academy/student/syllabus
   * Retrieve all syllabus information for courses the student is enrolled in.
   * Also supports ?studentId= for authorized staff inspection.
   */
  getStudentSyllabuses: async (req, res, next) => {
    try {
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');
      const isStudent = userRole === 'student' || userRoleId === '10';

      const queryStudentId = req.query.studentId || req.query.userId;
      const targetStudentId = isStudent ? (user.id || user._id) : (queryStudentId || user.id || user._id);

      const enrollments = await Enrollment.find({
        studentId: targetStudentId,
        status: { $in: ['active', 'paused', 'completed', 'ACTIVE', 'PAUSED', 'COMPLETED'] }
      })
        .populate('courseId', 'courseName courseCode category shortDescription description durationValue durationUnit status syllabus syllabusPdf')
        .populate('batchId', 'batchCode batchName startDate endDate')
        .lean();

      const syllabuses = enrollments.map(en => {
        const course = en.courseId || {};
        const batch = en.batchId || {};
        return {
          enrollmentId: en._id,
          status: en.status,
          course: {
            _id: course._id,
            courseName: course.courseName,
            courseCode: course.courseCode,
            category: course.category,
            shortDescription: course.shortDescription,
            description: course.description,
            durationValue: course.durationValue,
            durationUnit: course.durationUnit,
            status: course.status
          },
          batch: {
            _id: batch._id,
            batchCode: batch.batchCode,
            batchName: batch.batchName,
            startDate: batch.startDate,
            endDate: batch.endDate
          },
          syllabus: course.syllabus || [],
          syllabusPdf: course.syllabusPdf || null,
          pdfDownloadUrl: `/api/v1/academy/courses/${course._id}/syllabus/pdf`,
          pdfPreviewUrl: `/api/v1/academy/courses/${course._id}/syllabus/pdf?preview=true`
        };
      });

      return res.status(200).json({
        success: true,
        data: syllabuses
      });
    } catch (error) {
      next(error);
    }
  }
};

export default courseController;
