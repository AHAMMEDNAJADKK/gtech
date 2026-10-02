import mongoose from 'mongoose';
import StudentAttendance from '../models/studentattendance.js';
import User from '../models/user.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import Enrollment from '../models/enrollment.model.js';

export const markAttendance = async (req, res) => {
  try {
    const { user_id, studentId, batchId, courseId, date, status } = req.body;
    const targetStudentId = user_id || studentId;

    if (!targetStudentId || !batchId || !courseId || !date || !status) {
      return res.status(400).json({
        success: false,
        detail: 'user_id, batchId, courseId, date, and status parameters are required.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(targetStudentId))) {
      return res.status(400).json({ success: false, detail: 'Invalid student ID format.' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(batchId))) {
      return res.status(400).json({ success: false, detail: 'Invalid batch ID format.' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(courseId))) {
      return res.status(400).json({ success: false, detail: 'Invalid course ID format.' });
    }

    const uppercaseStatus = String(status).toUpperCase().trim();
    const validStatuses = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'UNMARKED'];
    if (!validStatuses.includes(uppercaseStatus)) {
      return res.status(400).json({
        success: false,
        detail: `Invalid attendance status '${status}'. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // 1. Verify Student exists
    const student = await User.findById(targetStudentId);
    if (!student) {
      return res.status(404).json({ success: false, detail: 'Student record not found.' });
    }

    // 2. Verify Course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, detail: 'Course record not found.' });
    }

    // 3. Verify Batch exists & belongs to Course
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, detail: 'Batch record not found.' });
    }

    if (String(batch.courseId) !== String(courseId)) {
      return res.status(400).json({
        success: false,
        detail: `Relationship conflict: Batch '${batch.batchName}' does not belong to Course '${course.courseName}'.`
      });
    }

    // 4. Verify Student belongs to Batch
    const batchStudents = (batch.students || []).map(s => String(s));
    const isDirectlyInBatch = batchStudents.includes(String(targetStudentId));
    
    let isEnrolledInBatch = isDirectlyInBatch;
    if (!isEnrolledInBatch) {
      const activeEnrollment = await Enrollment.findOne({
        studentId: targetStudentId,
        batchId,
        status: { $in: ['active', 'completed', 'paused'] }
      });
      if (activeEnrollment) isEnrolledInBatch = true;
    }

    if (!isEnrolledInBatch) {
      return res.status(400).json({
        success: false,
        detail: `Relationship conflict: Student '${student.name}' is not enrolled in Batch '${batch.batchName}'.`
      });
    }

    // 5. Upsert attendance record enforcing student + batch + course + date unique constraint
    const record = await StudentAttendance.findOneAndUpdate(
      {
        user_id: targetStudentId,
        batchId,
        courseId,
        date: String(date).trim()
      },
      {
        user_id: targetStudentId,
        batchId,
        courseId,
        date: String(date).trim(),
        status: uppercaseStatus,
        markedBy: req.user?.id || req.user?._id
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return res.status(200).json({
      success: true,
      data: record
    });

  } catch (err) {
    console.error('Mark Attendance Controller Error:', err);
    return res.status(500).json({
      success: false,
      detail: err.message || 'Internal server error while recording attendance.'
    });
  }
};

export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { batchId, courseId, user_id } = req.query;

    const query = { date: String(date).trim() };

    if (batchId && batchId !== 'ALL' && mongoose.Types.ObjectId.isValid(String(batchId))) {
      query.batchId = batchId;
    }

    if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(String(courseId))) {
      query.courseId = courseId;
    }

    if (user_id && mongoose.Types.ObjectId.isValid(String(user_id))) {
      query.user_id = user_id;
    }

    const records = await StudentAttendance.find(query)
      .populate('user_id', 'name email studentId')
      .populate('batchId', 'batchName batchCode')
      .populate('courseId', 'courseName courseCode')
      .lean();

    return res.status(200).json({
      success: true,
      data: records
    });

  } catch (err) {
    console.error('Get Attendance By Date Error:', err);
    return res.status(500).json({
      success: false,
      detail: err.message || 'Internal server error retrieving attendance.'
    });
  }
};

export const getStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { batchId, courseId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, detail: 'Invalid student ID format.' });
    }

    let studentObj = await User.findById(id).select('-password -passwordHash').lean();
    if (!studentObj) {
      const Student = (await import('../models/student.js')).default;
      if (Student) {
        studentObj = await Student.findById(id).select('-password').lean();
      }
    }

    if (!studentObj) {
      return res.status(404).json({
        success: false,
        detail: 'Student profile not found'
      });
    }

    const attQuery = { user_id: id };
    if (batchId && mongoose.Types.ObjectId.isValid(String(batchId))) {
      attQuery.batchId = batchId;
    }
    if (courseId && mongoose.Types.ObjectId.isValid(String(courseId))) {
      attQuery.courseId = courseId;
    }

    const attendanceRecords = await StudentAttendance.find(attQuery).lean();
    const totalMarked = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status?.toUpperCase() === 'PRESENT').length;
    const lateCount = attendanceRecords.filter(r => r.status?.toUpperCase() === 'LATE').length;
    const leaveCount = attendanceRecords.filter(r => r.status?.toUpperCase() === 'LEAVE').length;
    const absentCount = attendanceRecords.filter(r => r.status?.toUpperCase() === 'ABSENT').length;
    
    // Present + Late counted as positive attendance
    const positiveCount = presentCount + lateCount;
    const attendancePercentage = totalMarked > 0 ? Math.round((positiveCount / totalMarked) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        student: studentObj,
        attendanceSummary: {
          totalMarked,
          presentCount,
          lateCount,
          leaveCount,
          absentCount,
          attendancePercentage
        }
      }
    });
  } catch (err) {
    console.error('Get Student Profile Error:', err);
    return res.status(500).json({
      success: false,
      detail: err.message || 'Internal server error retrieving student profile.'
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, detail: 'Invalid student ID format.' });
    }

    // 1. Delete associated attendance records
    await StudentAttendance.deleteMany({ user_id: id });

    // 2. Delete associated enrollment records (handles both string and ObjectId references)
    await Enrollment.deleteMany({
      $or: [
        { studentId: id },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ studentId: new mongoose.Types.ObjectId(id) }] : [])
      ]
    });

    // 3. Remove student from all batch rosters
    await Batch.updateMany(
      { students: id },
      { $pull: { students: id } }
    );
    if (mongoose.Types.ObjectId.isValid(id)) {
      await Batch.updateMany(
        { students: new mongoose.Types.ObjectId(id) },
        { $pull: { students: new mongoose.Types.ObjectId(id) } }
      );
    }

    // 4. Delete student user record
    let deletedStudent = await User.findByIdAndDelete(id);
    if (!deletedStudent) {
      const Student = (await import('../models/student.js')).default;
      if (Student) {
        deletedStudent = await Student.findByIdAndDelete(id);
      }
    }

    if (!deletedStudent) {
      return res.status(404).json({ success: false, detail: 'Student profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Student record, enrollment tracking, and attendance history successfully deleted.'
    });

  } catch (err) {
    console.error('Delete Student Error:', err);
    return res.status(500).json({
      success: false,
      detail: err.message || 'Internal server error while deleting student.'
    });
  }
};

