// ===============================
// BACKEND: attendance.controller.js
// ===============================

import Attendance from '../models/attendance.model.js';
import StudentAttendance from '../models/studentattendance.js';

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

const checkIsLate = (dateObj) => {
  try {
    const istTime = dateObj.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const [hours, minutes] = istTime
      .split(':')
      .map(Number);

    return (
      hours > 9 ||
      (hours === 9 && minutes > 0)
    );

  } catch {
    return false;
  }
};

const calculateShiftMetrics = (
  checkIn,
  checkOut
) => {
  try {
    const totalMs =
      checkOut.getTime() - checkIn.getTime();

    const totalHours = Math.max(
      0,
      totalMs / (1000 * 60 * 60)
    );

    const overtime = Math.max(
      0,
      totalHours - 8
    );

    return {
      working_hours: totalHours.toFixed(2),
      overtime: overtime.toFixed(2)
    };

  } catch {
    return {
      working_hours: "0.00",
      overtime: "0.00"
    };
  }
};

const serializeAttendance = (record) => {
  if (!record) return null;

  const obj = record.toObject ? record.toObject() : record;

  let userIdVal = obj.user_id;
  if (userIdVal && typeof userIdVal === 'object') {
    if (userIdVal._id) {
      userIdVal = {
        ...userIdVal,
        id: userIdVal._id.toString()
      };
    }
  } else if (userIdVal) {
    userIdVal = userIdVal.toString();
  }

  return {
    ...obj,
    id: obj._id ? obj._id.toString() : (obj.id || ''),
    user_id: userIdVal
  };
};

// ===============================
// CHECK IN
// ===============================

export const checkIn = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        detail: "Authentication required."
      });
    }

    const isStudent = String(req.user?.role || '').toLowerCase() === 'student' || String(req.user?.role_id || '') === '10';
    if (isStudent) {
      return res.status(403).json({
        detail: "Shift attendance is reserved for employees. Student class attendance is managed by instructors."
      });
    }

    const userId =
      req.user.id || req.user._id;

    const todayStr = getISTDate();

    const now = new Date();

    const existing = await Attendance.findOne({
      user_id: userId,
      date: todayStr
    });

    if (existing?.check_in_time) {
      return res.status(400).json({
        detail:
          "Already checked in today."
      });
    }

    const record =
      await Attendance.findOneAndUpdate(
        {
          user_id: userId,
          date: todayStr
        },
        {
          $set: {
            user_id: userId,
            date: todayStr,
            status: 'PRESENT',
            check_in_time: now,
            is_late: checkIsLate(now)
          }
        },
        {
          upsert: true,
          new: true
        }
      );

    return res.status(201).json(
      serializeAttendance(record)
    );

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      detail: error.message
    });
  }
};

// ===============================
// CHECK OUT
// ===============================

export const checkOut = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        detail: "Authentication required."
      });
    }

    const isStudent = String(req.user?.role || '').toLowerCase() === 'student' || String(req.user?.role_id || '') === '10';
    if (isStudent) {
      return res.status(403).json({
        detail: "Shift attendance is reserved for employees. Student class attendance is managed by instructors."
      });
    }

    const userId =
      req.user.id || req.user._id;

    const todayStr = getISTDate();

    const record =
      await Attendance.findOne({
        user_id: userId,
        date: todayStr
      });

    if (!record?.check_in_time) {
      return res.status(400).json({
        detail:
          "Please check in first."
      });
    }

    if (record.check_out_time) {
      return res.status(400).json({
        detail:
          "Already checked out."
      });
    }

    const now = new Date();

    const metrics =
      calculateShiftMetrics(
        record.check_in_time,
        now
      );

    record.check_out_time = now;
    record.working_hours =
      metrics.working_hours;
    record.overtime =
      metrics.overtime;

    await record.save();

    return res.status(200).json(
      serializeAttendance(record)
    );

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      detail: error.message
    });
  }
};

// ===============================
// GET BY DATE
// ===============================

export const getAttendanceByDate =
    async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            detail: "Authentication required."
          });
        }
  
        const userId =
          req.user.id || req.user._id;
  
        const { date } = req.params;
  
        const record =
          await Attendance.findOne({
            user_id: userId,
            date
          });
  
        const serialized = serializeAttendance(record);
        return res.status(200).json({
          success: true,
          data: serialized,
          attendance: serialized,
          ...(serialized || {})
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          detail: "Server Error"
        });
      }
    };

export const getAllAttendanceByDate =
    async (req, res) => {
      try {
        const { date } = req.params;
        const records = await Attendance.find({ date }).populate('user_id', 'name email role department designation employeeId avatar profile_image');
        return res.status(200).json(records.map(serializeAttendance));
      } catch (err) {
        console.error(err);
        return res.status(500).json({ detail: "Server Error" });
      }
    };

export const markUserAttendance = async (req, res) => {
  try {
    const { user_id, date, status, check_in_time, check_out_time, working_hours, is_late, overtime } = req.body;

    if (!user_id || !date) {
      return res.status(400).json({ detail: "User ID and date are required." });
    }

    let checkInDate = check_in_time ? new Date(check_in_time) : null;
    let checkOutDate = check_out_time ? new Date(check_out_time) : null;

    let computedHours = working_hours || "0.00";
    let computedOvertime = overtime || "0.00";

    if (checkInDate && checkOutDate) {
      const metrics = calculateShiftMetrics(checkInDate, checkOutDate);
      computedHours = metrics.working_hours;
      computedOvertime = metrics.overtime;
    }

    const record = await Attendance.findOneAndUpdate(
      { user_id, date },
      {
        $set: {
          user_id,
          date,
          status: status || (checkInDate ? 'PRESENT' : 'ABSENT'),
          check_in_time: checkInDate,
          check_out_time: checkOutDate,
          working_hours: computedHours,
          is_late: is_late ?? (checkInDate ? checkIsLate(checkInDate) : false),
          overtime: computedOvertime
        }
      },
      { upsert: true, new: true }
    ).populate('user_id', 'name email role department designation employeeId avatar profile_image');

    return res.status(200).json(serializeAttendance(record));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ detail: error.message });
  }
};

export const getMyShift = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ detail: "Authentication required." });
    }
    const isStudent = String(req.user?.role || '').toLowerCase() === 'student' || String(req.user?.role_id || '') === '10';
    const userId = req.user.id || req.user._id;
    const todayStr = getISTDate();

    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    if (isStudent) {
      return res.status(200).json({
        success: true,
        today: todayStr,
        serverTimeIST: istTimeStr,
        isActiveShift: false,
        currentWorkingHours: "0.00",
        attendance: null,
        data: null,
        isStudent: true
      });
    }

    const record = await Attendance.findOne({ user_id: userId, date: todayStr });

    const isActive = Boolean(record?.check_in_time && !record?.check_out_time);
    let currentWorkingHours = record?.working_hours || "0.00";
    if (isActive && record?.check_in_time) {
      const ms = now.getTime() - new Date(record.check_in_time).getTime();
      const hrs = Math.max(0, ms / (1000 * 60 * 60));
      currentWorkingHours = hrs.toFixed(2);
    }

    const serialized = serializeAttendance(record);

    return res.status(200).json({
      success: true,
      today: todayStr,
      serverTimeIST: istTimeStr,
      isActiveShift: isActive,
      currentWorkingHours,
      attendance: serialized,
      data: serialized
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ detail: error.message });
  }
};

export const getMyHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ detail: "Authentication required." });
    }
    const isStudent = String(req.user?.role || '').toLowerCase() === 'student' || String(req.user?.role_id || '') === '10';
    const userId = req.user.id || req.user._id;
    const limit = parseInt(req.query.limit, 10) || 30;

    if (isStudent) {
      const studentRecords = await StudentAttendance.find({ user_id: userId })
        .sort({ date: -1 })
        .limit(limit)
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .lean();

      const formatted = studentRecords.map(r => ({
        id: r._id.toString(),
        date: r.date,
        status: r.status,
        courseName: r.courseId?.courseName || 'Course',
        batchName: r.batchId?.batchName || 'Batch',
        markedAt: r.createdAt
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
        isStudent: true
      });
    }

    const records = await Attendance.find({ user_id: userId })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: records.map(serializeAttendance)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ detail: error.message });
  }
};

export const getAttendanceSummary = async (req, res) => {
  try {
    const userRole = String(req.user?.role || '').toLowerCase();
    const userRoleId = String(req.user?.role_id || '');
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin || userRole === 'superadmin' || userRoleId === '0');
    const isHr = Boolean(userRole === 'hr' || userRoleId === '2');

    if (!isSuperAdmin && !isHr) {
      return res.status(403).json({
        success: false,
        detail: "Access denied. Only Super Admin and HR can view organization attendance summary."
      });
    }

    const todayStr = req.query.date || getISTDate();
    const records = await Attendance.find({ date: todayStr }).populate('user_id', 'name email role department designation employeeId avatar');
    const totalStaff = records.length;
    const activeShifts = records.filter(r => r.check_in_time && !r.check_out_time).length;
    const completedShifts = records.filter(r => r.check_out_time).length;
    const lateArrivals = records.filter(r => r.is_late).length;

    return res.status(200).json({
      success: true,
      date: todayStr,
      totalMarked: totalStaff,
      activeShifts,
      completedShifts,
      lateArrivals,
      records: records.map(serializeAttendance)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ detail: error.message });
  }
};