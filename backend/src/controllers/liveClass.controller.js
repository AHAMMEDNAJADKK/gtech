import mongoose from 'mongoose';
import LiveClass from '../models/liveClass.model.js';
import Enrollment from '../models/enrollment.model.js';
import Batch from '../models/batch.model.js';

export const liveClassController = {
  /**
   * GET /api/v1/live-classes
   * List live class sessions. If student, filters to their enrolled batches.
   */
  getLiveClasses: async (req, res) => {
    try {
      const { courseId, batchId, status, date } = req.query;
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');

      const query = {};

      if (userRole === 'student' || userRoleId === '10') {
        const studentId = user.id || user._id;
        // Find student's active enrollments
        const enrollments = await Enrollment.find({
          studentId,
          status: { $in: ['active', 'completed', 'paused'] }
        }).select('batchId');

        const batchIds = enrollments.map(e => e.batchId).filter(Boolean);
        query.batchId = { $in: batchIds };
      } else if (batchId && batchId !== 'ALL' && mongoose.Types.ObjectId.isValid(batchId)) {
        query.batchId = batchId;
      }

      if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(courseId)) {
        query.courseId = courseId;
      }

      if (status && status !== 'ALL') {
        query.status = status;
      }

      if (date) {
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.scheduledDate = { $gte: targetDate, $lt: nextDay };
      }

      const sessions = await LiveClass.find(query)
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('instructorId', 'name email phone profile_image')
        .sort({ scheduledDate: 1, startTime: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error) {
      console.error('Error fetching live classes:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve live classes.', error: error.message });
    }
  },

  /**
   * GET /api/v1/live-classes/:id
   */
  getLiveClassById: async (req, res) => {
    try {
      const { id } = req.params;
      const session = await LiveClass.findById(id)
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .populate('instructorId', 'name email phone profile_image')
        .lean();

      if (!session) {
        return res.status(404).json({ success: false, message: 'Live class session not found.' });
      }

      return res.status(200).json({ success: true, data: session });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve session.', error: error.message });
    }
  },

  /**
   * POST /api/v1/live-classes
   * Admin or Instructor creates live class session
   */
  createLiveClass: async (req, res) => {
    try {
      const {
        title,
        description,
        courseId,
        batchId,
        instructorId,
        platform = 'Google Meet',
        meetingUrl,
        meetingId,
        passcode,
        scheduledDate,
        startTime,
        endTime,
        durationMinutes
      } = req.body;

      if (!title || !courseId || !batchId || !meetingUrl) {
        return res.status(400).json({
          success: false,
          message: 'Title, course, batch, and meeting URL are required.'
        });
      }

      const assignedInstructorId = instructorId || req.user?.id || req.user?._id;

      // Extract scheduledDate and startTime with robust fallbacks
      let finalDate = scheduledDate ? new Date(scheduledDate) : null;
      let finalStartTime = startTime ? startTime.trim() : '';

      if (req.body.scheduledStartTime) {
        const parsedStart = new Date(req.body.scheduledStartTime);
        if (!isNaN(parsedStart.getTime())) {
          if (!finalDate) finalDate = parsedStart;
          if (!finalStartTime) {
            finalStartTime = parsedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }
      }

      if (!finalDate || isNaN(finalDate.getTime())) {
        finalDate = new Date();
      }
      if (!finalStartTime) {
        finalStartTime = '10:00 AM';
      }

      const newSession = await LiveClass.create({
        title: title.trim(),
        description: description || '',
        courseId,
        batchId,
        instructorId: assignedInstructorId,
        platform,
        meetingUrl: meetingUrl.trim(),
        meetingId: meetingId || '',
        passcode: passcode || '',
        scheduledDate: finalDate,
        startTime: finalStartTime,
        endTime: endTime || '',
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        status: 'UPCOMING',
        createdBy: req.user?.id || req.user?._id
      });

      return res.status(201).json({
        success: true,
        message: 'Live classroom session scheduled successfully.',
        data: newSession
      });
    } catch (error) {
      console.error('Error creating live class:', error);
      return res.status(500).json({ success: false, message: 'Failed to schedule live class.', error: error.message });
    }
  },

  /**
   * PUT /api/v1/live-classes/:id
   */
  updateLiveClass: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedBy: req.user?.id || req.user?._id };

      const updated = await LiveClass.findByIdAndUpdate(id, updateData, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Session not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Live class session updated successfully.',
        data: updated
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to update session.', error: error.message });
    }
  },

  /**
   * PATCH /api/v1/live-classes/:id/status
   */
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value.' });
      }

      const updated = await LiveClass.findByIdAndUpdate(
        id,
        { status, updatedBy: req.user?.id || req.user?._id },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Session not found.' });
      }

      return res.status(200).json({
        success: true,
        message: `Class status updated to ${status}.`,
        data: updated
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to update status.', error: error.message });
    }
  },

  /**
   * DELETE /api/v1/live-classes/:id
   */
  deleteLiveClass: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await LiveClass.findByIdAndDelete(id);

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Session not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Live class session deleted successfully.'
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to delete session.', error: error.message });
    }
  }
};

export default liveClassController;
