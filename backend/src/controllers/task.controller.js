import Task from '../models/task.model.js';
import mongoose from 'mongoose';

export const taskController = {
  /**
   * GET /api/v1/tasks/all
   * GET /api/v1/tasks
   * Retrieve tasks scoped to authenticated user or all for administrators
   */
  async getAllTasks(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      const roleStr = String(req.user?.role || '').toLowerCase().trim();
      const roleIdStr = String(req.user?.role_id || req.user?.roleId || '').trim();
      const isSuperAdmin = req.user?.isSuperAdmin === true || roleStr === 'superadmin' || roleIdStr === '0';
      const isAdmin = isSuperAdmin || roleStr === 'admin' || roleIdStr === '1' || roleIdStr === '2';

      const { status, search } = req.query;
      const query = {};

      if (status && status !== 'all') {
        query.status = status;
      }

      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ title: regex }, { description: regex }, { project: regex }];
      }

      // If not an administrator, scope to tasks assigned to this user or created by them
      if (!isAdmin && userId) {
        const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        query.$or = [
          { assigned_to: userObjId },
          { createdBy: userObjId }
        ];
      }

      const tasks = await Task.find(query)
        .populate('assigned_to', 'name email employeeId designation')
        .populate('createdBy', 'name email employeeId')
        .sort({ dueDate: 1, createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        tasks: tasks || [],
        data: tasks || [],
        count: tasks ? tasks.length : 0
      });
    } catch (err) {
      console.error('Error fetching tasks:', err);
      next(err);
    }
  },

  /**
   * POST /api/v1/tasks
   */
  async createTask(req, res, next) {
    try {
      const { title, description, assigned_to, dueDate, priority, project, client, designation_id } = req.body;
      const creatorId = req.user?.id || req.user?._id;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Task title is required.'
        });
      }

      let parsedAssignees = [];
      if (Array.isArray(assigned_to)) {
        parsedAssignees = assigned_to.filter(id => mongoose.Types.ObjectId.isValid(id));
      } else if (assigned_to && mongoose.Types.ObjectId.isValid(assigned_to)) {
        parsedAssignees = [assigned_to];
      }

      const newTask = await Task.create({
        title: title.trim(),
        description: description ? description.trim() : '',
        assigned_to: parsedAssignees,
        designation_id: designation_id && mongoose.Types.ObjectId.isValid(designation_id) ? designation_id : null,
        project: project ? project.trim() : '',
        client: client ? client.trim() : '',
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'medium',
        createdBy: creatorId
      });

      return res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: newTask
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/v1/tasks/:id
   */
  async updateTask(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid task ID.' });
      }

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found.' });
      }

      const allowedFields = ['title', 'description', 'assigned_to', 'status', 'priority', 'dueDate', 'notes', 'project', 'client'];
      allowedFields.forEach(f => {
        if (req.body[f] !== undefined) {
          task[f] = req.body[f];
        }
      });

      await task.save();

      return res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: task
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/v1/tasks/:id
   */
  async deleteTask(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid task ID.' });
      }

      await Task.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (err) {
      next(err);
    }
  }
};
