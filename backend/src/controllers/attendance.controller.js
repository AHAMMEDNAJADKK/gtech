// ===============================
// BACKEND: attendance.controller.js
// ===============================

import Attendance from '../models/attendance.model.js';

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
  
        return res.status(200).json(
          serializeAttendance(record)
        );
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