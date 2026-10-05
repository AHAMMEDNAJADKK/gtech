import EmployeeTraining from '../models/employeeTraining.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAudit } from '../middleware/audit.middleware.js';

/**
 * Helper to sync employeeProgress array when assignedEmployees list changes
 */
const syncEmployeeProgress = (currentProgress = [], assignedEmployeeIds = []) => {
  const existingMap = new Map();
  currentProgress.forEach(p => {
    if (p.employeeId) existingMap.set(p.employeeId.toString(), p);
  });

  return assignedEmployeeIds.map(empId => {
    const idStr = empId.toString();
    if (existingMap.has(idStr)) {
      return existingMap.get(idStr);
    }
    return {
      employeeId: empId,
      status: 'NOT_STARTED',
      progressPercent: 0,
      score: null,
      remarks: '',
      completedAt: null
    };
  });
};

export const employeeTrainingController = {

  /**
   * GET /api/v1/employee-training
   * Fetch all training courses with search, status filter, and stats
   */
  getAll: async (req, res, next) => {
    try {
      const { search = '', status = 'ALL', category = 'ALL' } = req.query;
      const query = {};

      if (search) {
        const safeSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { courseName: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { category: { $regex: safeSearch, $options: 'i' } },
          { trainer: { $regex: safeSearch, $options: 'i' } },
          { targetAudience: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      if (status && status !== 'ALL') query.status = status;
      if (category && category !== 'ALL') query.category = category;

      const [courses, statsAgg] = await Promise.all([
        EmployeeTraining.find(query)
          .populate('assignedEmployees', 'name email designation department profile_image avatar')
          .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar')
          .populate('createdBy', 'name')
          .sort({ createdAt: -1 })
          .lean(),
        EmployeeTraining.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
      ]);

      const stats = { total: 0, active: 0, draft: 0, completed: 0, inactive: 0 };
      statsAgg.forEach(s => {
        stats.total += s.count;
        if (s._id === 'ACTIVE') stats.active = s.count;
        if (s._id === 'DRAFT') stats.draft = s.count;
        if (s._id === 'COMPLETED') stats.completed = s.count;
        if (s._id === 'INACTIVE') stats.inactive = s.count;
      });

      return res.status(200).json({ success: true, data: courses, stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employee-training/my-training
   * Fetch courses assigned to the logged-in user
   */
  getMyAssignedTraining: async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(200).json({ success: true, data: [] });
      }

      const courses = await EmployeeTraining.find({
        assignedEmployees: userId,
        status: { $ne: 'INACTIVE' }
      })
        .populate('assignedEmployees', 'name email designation department profile_image avatar')
        .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, data: courses });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/employee-training
   * Create a new training course with assigned employees
   */
  create: async (req, res, next) => {
    try {
      const {
        courseName, category, description,
        trainer, startDate, dueDate, materialsUrl, modules,
        durationValue, durationUnit,
        targetAudience, isMandatory, isOccasional,
        scheduledDate, status, assignedEmployees
      } = req.body;

      if (!courseName || !courseName.trim()) {
        throw new AppError('Course name is required.', 400);
      }

      const assignedList = Array.isArray(assignedEmployees) ? assignedEmployees : [];
      const employeeProgress = syncEmployeeProgress([], assignedList);

      const newTraining = await EmployeeTraining.create({
        courseName: courseName.trim(),
        category: category || 'General',
        description: description || '',
        trainer: trainer || '',
        startDate: startDate || null,
        dueDate: dueDate || null,
        materialsUrl: materialsUrl || '',
        modules: Array.isArray(modules) ? modules : [],
        durationValue: parseInt(durationValue) || 1,
        durationUnit: durationUnit || 'Days',
        targetAudience: targetAudience || 'ALL',
        isMandatory: !!isMandatory,
        isOccasional: !!isOccasional,
        scheduledDate: scheduledDate || null,
        status: status || 'ACTIVE',
        assignedEmployees: assignedList,
        employeeProgress,
        createdBy: req.user?.id || req.user?._id
      });

      const populated = await EmployeeTraining.findById(newTraining._id)
        .populate('assignedEmployees', 'name email designation department profile_image avatar')
        .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar')
        .lean();

      await recordAudit(req, {
        action: 'CREATE',
        entity: 'EmployeeTraining',
        entityId: newTraining._id,
        newValue: newTraining
      });

      return res.status(201).json({
        success: true,
        message: 'Training course created successfully.',
        data: populated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/employee-training/:id
   * Update full course details including assigned employees
   */
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await EmployeeTraining.findById(id);
      if (!course) throw new AppError('Training course not found.', 404);

      const {
        courseName, category, description,
        trainer, startDate, dueDate, materialsUrl, modules,
        durationValue, durationUnit,
        targetAudience, isMandatory, isOccasional,
        scheduledDate, status, assignedEmployees
      } = req.body;

      const oldValue = course.toObject();

      if (courseName !== undefined) course.courseName = courseName.trim();
      if (category !== undefined) course.category = category;
      if (description !== undefined) course.description = description;
      if (trainer !== undefined) course.trainer = trainer;
      if (startDate !== undefined) course.startDate = startDate || null;
      if (dueDate !== undefined) course.dueDate = dueDate || null;
      if (materialsUrl !== undefined) course.materialsUrl = materialsUrl;
      if (Array.isArray(modules)) course.modules = modules;
      if (durationValue !== undefined) course.durationValue = parseInt(durationValue) || 1;
      if (durationUnit !== undefined) course.durationUnit = durationUnit;
      if (targetAudience !== undefined) course.targetAudience = targetAudience;
      if (isMandatory !== undefined) course.isMandatory = !!isMandatory;
      if (isOccasional !== undefined) course.isOccasional = !!isOccasional;
      if (scheduledDate !== undefined) course.scheduledDate = scheduledDate || null;
      if (status !== undefined) course.status = status;

      if (Array.isArray(assignedEmployees)) {
        course.assignedEmployees = assignedEmployees;
        course.employeeProgress = syncEmployeeProgress(course.employeeProgress, assignedEmployees);
      }

      course.updatedBy = req.user?.id || req.user?._id;
      course.markModified('employeeProgress');
      await course.save();

      const populated = await EmployeeTraining.findById(id)
        .populate('assignedEmployees', 'name email designation department profile_image avatar')
        .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar')
        .lean();

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'EmployeeTraining',
        entityId: id,
        oldValue,
        newValue: course
      });

      return res.status(200).json({
        success: true,
        message: 'Training course updated successfully.',
        data: populated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/employee-training/:id/progress
   * Update individual employee progress, status, score, or remarks
   */
  updateEmployeeProgress: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { employeeId, status, progressPercent, completedModules, score, remarks } = req.body;

      const getEmpIdStr = (emp) => {
        if (!emp) return '';
        if (emp._id) return emp._id.toString();
        return emp.toString();
      };

      const targetEmpId = employeeId || req.user?.id || req.user?._id || req.user?.userId;
      const course = await EmployeeTraining.findById(id);
      if (!course) throw new AppError('Training course not found.', 404);

      let record = course.employeeProgress.find(p => getEmpIdStr(p.employeeId) === targetEmpId.toString());

      if (!record) {
        record = {
          employeeId: targetEmpId,
          status: 'NOT_STARTED',
          progressPercent: 0,
          completedModules: [],
          score: null,
          remarks: '',
          completedAt: null
        };
        course.employeeProgress.push(record);
      }

      if (Array.isArray(completedModules)) {
        record.completedModules = completedModules;
        const total = (course.modules || []).length;
        if (total > 0) {
          const pct = Math.round((completedModules.length / total) * 100);
          record.progressPercent = Math.min(100, Math.max(0, pct));
        } else {
          record.progressPercent = 100;
        }
        if (record.progressPercent === 100) {
          record.status = 'COMPLETED';
          record.completedAt = new Date();
        } else if (record.progressPercent > 0) {
          record.status = 'IN_PROGRESS';
        } else {
          record.status = 'NOT_STARTED';
          record.completedAt = null;
        }
      } else {
        if (status !== undefined) {
          record.status = status;
          if (status === 'COMPLETED') {
            record.progressPercent = 100;
            record.completedAt = new Date();
          }
        }

        if (progressPercent !== undefined) {
          record.progressPercent = Math.min(100, Math.max(0, parseInt(progressPercent) || 0));
          if (record.progressPercent === 100) {
            record.status = 'COMPLETED';
            record.completedAt = new Date();
          } else if (record.progressPercent > 0 && record.status === 'NOT_STARTED') {
            record.status = 'IN_PROGRESS';
          }
        }

        // Sync completedModules with progressPercent if modules exist
        const total = (course.modules || []).length;
        if (total > 0) {
          const doneCount = Math.min(total, Math.round(((record.progressPercent || 0) / 100) * total));
          record.completedModules = Array.from({ length: doneCount }, (_, idx) => idx);
        }
      }

      if (score !== undefined) record.score = score !== null && score !== '' ? parseFloat(score) : null;
      if (remarks !== undefined) record.remarks = remarks;

      course.markModified('employeeProgress');
      await course.save();

      const populated = await EmployeeTraining.findById(id)
        .populate('assignedEmployees', 'name email designation department profile_image avatar')
        .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar')
        .lean();

      return res.status(200).json({
        success: true,
        message: 'Employee progress updated successfully.',
        data: populated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/employee-training/:id/status
   * Quick status-only update for course catalog
   */
  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const allowed = ['ACTIVE', 'DRAFT', 'COMPLETED', 'INACTIVE'];
      if (!allowed.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${allowed.join(', ')}`, 400);
      }

      const course = await EmployeeTraining.findByIdAndUpdate(
        id,
        { status, updatedBy: req.user?.id || req.user?._id },
        { new: true }
      )
        .populate('assignedEmployees', 'name email designation department profile_image avatar')
        .populate('employeeProgress.employeeId', 'name email designation department profile_image avatar');

      if (!course) throw new AppError('Training course not found.', 404);

      return res.status(200).json({
        success: true,
        message: `Status updated to ${status}.`,
        data: course
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/employee-training/:id
   * Delete a training course
   */
  remove: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await EmployeeTraining.findById(id);
      if (!course) throw new AppError('Training course not found.', 404);

      const oldValue = course.toObject();
      await EmployeeTraining.findByIdAndDelete(id);

      await recordAudit(req, {
        action: 'DELETE',
        entity: 'EmployeeTraining',
        entityId: id,
        oldValue,
        newValue: null
      });

      return res.status(200).json({
        success: true,
        message: 'Training course deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
};

export default employeeTrainingController;
