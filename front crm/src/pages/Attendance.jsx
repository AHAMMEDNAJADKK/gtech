// ===============================
// FRONTEND: Attendance.jsx
// ===============================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  LogIn,
  LogOut,
  History,
  Timer,
  Loader2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Edit3,
  X,
  Save
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ===============================
// HELPERS
// ===============================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

const parseAsUTC = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  const value = String(dateInput);
  return new Date(value.endsWith('Z') ? value : `${value}Z`);
};

const formatToISTFull = (dateInput) => {
  if (!dateInput) return '---';
  try {
    return parseAsUTC(dateInput).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch {
    return '---';
  }
};

const formatTime = (dateInput) => {
  if (!dateInput) return '---';
  try {
    return parseAsUTC(dateInput).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '---';
  }
};

const calculateWorkingHours = (checkIn, checkOut, targetDateStr = null) => {
  if (!checkIn) return "0.00";
  const start = parseAsUTC(checkIn);
  let end;
  if (checkOut) {
    end = parseAsUTC(checkOut);
  } else {
    const isToday = targetDateStr ? targetDateStr === getISTDate() : true;
    if (isToday) {
      end = new Date();
    } else {
      return "0.00";
    }
  }
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000).toFixed(2);
};

// ===============================
// LIVE CLOCK
// ===============================

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="flex items-baseline gap-4 mb-4">
        <div className="text-8xl lg:text-[10rem] font-black text-slate-900 dark:text-slate-100 italic tracking-tighter leading-none select-none">
          {time.getHours().toString().padStart(2, '0')}
          <span className="animate-pulse text-indigo-500">:</span>
          {time.getMinutes().toString().padStart(2, '0')}
        </div>
        <div className="text-2xl lg:text-4xl font-mono text-indigo-500/50 font-bold w-12">
          {time.getSeconds().toString().padStart(2, '0')}
        </div>
      </div>
      <p className="text-[10px] tracking-[0.5em] text-slate-600 dark:text-slate-400 font-black uppercase mb-12">
        Universal Time Protocol
      </p>
    </>
  );
};

// ===============================
// EDIT / SAVE ATTENDANCE MODAL
// ===============================

const MarkAttendanceModal = ({ isOpen, onClose, staff, targetDate, onSaveSuccess }) => {
  const [inTime, setInTime] = useState('09:30');
  const [outTime, setOutTime] = useState('18:00');
  const [status, setStatus] = useState('PRESENT');
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState(null);

  useEffect(() => {
    if (staff?.checkIn) {
      const d = parseAsUTC(staff.checkIn);
      if (d) {
        setInTime(d.toTimeString().substring(0, 5));
      }
    } else {
      setInTime('09:30');
    }

    if (staff?.checkOut) {
      const d = parseAsUTC(staff.checkOut);
      if (d) {
        setOutTime(d.toTimeString().substring(0, 5));
      }
    } else {
      setOutTime('18:00');
    }

    if (staff?.status) {
      setStatus(staff.status === 'ABSENT' ? 'ABSENT' : (staff.status === 'LATE' ? 'LATE' : 'PRESENT'));
    }
  }, [staff]);

  if (!isOpen || !staff) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalErr(null);

    try {
      const rawToken = localStorage.getItem('token');
      const token = rawToken ? rawToken.replace(/"/g, '') : '';

      let checkInISO = null;
      let checkOutISO = null;

      if (status !== 'ABSENT') {
        if (inTime) {
          checkInISO = new Date(`${targetDate}T${inTime}:00`).toISOString();
        }
        if (outTime) {
          checkOutISO = new Date(`${targetDate}T${outTime}:00`).toISOString();
        }
      }

      const res = await fetch(`${API_BASE}/attendance/mark-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: staff.userId,
          date: targetDate,
          status,
          check_in_time: checkInISO,
          check_out_time: checkOutISO,
          is_late: status === 'LATE'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to save attendance record");
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      setModalErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
            Log Attendance Record
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Updating attendance log for <strong className="text-indigo-600 dark:text-indigo-400">{staff.name}</strong> on <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{targetDate}</span>.
          </p>
        </div>

        {modalErr && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 text-xs font-bold">
            {modalErr}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Attendance Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="PRESENT">PRESENT (On Time)</option>
              <option value="LATE">LATE ENTRY</option>
              <option value="ABSENT">ABSENT / NOT CHECKED IN</option>
            </select>
          </div>

          {status !== 'ABSENT' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Check-In Time</label>
                <input
                  type="time"
                  value={inTime}
                  onChange={(e) => setInTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Check-Out Time</label>
                <input
                  type="time"
                  value={outTime}
                  onChange={(e) => setOutTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===============================
// MAIN COMPONENT
// ===============================

const Attendance = () => {
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selected Date & Calendar States
  const [selectedDate, setSelectedDate] = useState(getISTDate());
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [showCalendar, setShowCalendar] = useState(false);

  // Edit / Log Modal State
  const [editingStaff, setEditingStaff] = useState(null);

  // Roster / All Staff Logs States
  const [allAttendance, setAllAttendance] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const prevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const nextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const daysInMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonth + 1, 0).getDate();
  }, [calendarYear, calendarMonth]);

  const firstDayIndex = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).getDay();
  }, [calendarYear, calendarMonth]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch Current Logged-In User's Today Status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const todayStr = getISTDate();
      const response = await fetch(
        `${API_BASE}/attendance/${todayStr}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        setTodayLog(null);
        return;
      }
      const data = await response.json();
      setTodayLog(data || null);
    } catch {
      setError("System Sync Failed");
      setTodayLog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Fetch Selected Date's Personal Log
  const fetchSelectedDateStatus = useCallback(async (dateStr) => {
    try {
      setSelectedLoading(true);
      const response = await fetch(
        `${API_BASE}/attendance/${dateStr}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        setSelectedLog(null);
        return;
      }
      const data = await response.json();
      setSelectedLog(data || null);
    } catch {
      setSelectedLog(null);
    } finally {
      setSelectedLoading(false);
    }
  }, []);

  // Fetch All Staff Attendance & Users for Selected Date
  const fetchAllAttendanceLogs = useCallback(async (dateStr) => {
    try {
      setLogsLoading(true);
      const headers = getHeaders();
      const [attRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/attendance/all/${dateStr}`, { headers }),
        fetch(`${API_BASE}/users/list`, { headers })
      ]);

      if (attRes.ok) {
        const attData = await attRes.json();
        setAllAttendance(Array.isArray(attData) ? attData : []);
      } else {
        setAllAttendance([]);
      }

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setAllUsers(Array.isArray(uData) ? uData : (uData.data || []));
      }
    } catch (err) {
      console.error("Error fetching all attendance logs:", err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSelectedDateStatus(selectedDate);
    fetchAllAttendanceLogs(selectedDate);
  }, [selectedDate, fetchSelectedDateStatus, fetchAllAttendanceLogs]);

  const handleAction = async (type) => {
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/attendance/${type}`,
        {
          method: 'POST',
          headers: getHeaders()
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Action denied");
      }

      setSuccessMsg(`${type.replace('-', ' ')} successful!`);

      await fetchStatus();
      if (selectedDate === getISTDate()) {
        fetchSelectedDateStatus(selectedDate);
        fetchAllAttendanceLogs(selectedDate);
      }

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);

    } catch (err) {
      setError(err.message);
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const liveWorkingHours = useMemo(() => {
    if (!todayLog?.check_in_time) return "0.00";
    if (todayLog?.check_out_time) {
      return calculateWorkingHours(
        todayLog.check_in_time,
        todayLog.check_out_time
      );
    }
    return calculateWorkingHours(
      todayLog.check_in_time,
      currentTime
    );
  }, [todayLog, currentTime]);

  // Combine All Users and Attendance Logs for Selected Date
  const mergedAttendanceList = useMemo(() => {
    const isSuperUser = (u) => {
      if (!u) return false;
      const roleStr = String(u.role || '').toLowerCase().trim();
      const roleIdStr = String(u.role_id || u.roleId || '').trim();
      const nameStr = String(u.name || '').toLowerCase().trim();
      return (
        u.isSuperAdmin === true ||
        u.is_super_admin === true ||
        roleStr === 'superadmin' ||
        roleStr === 'super admin' ||
        roleIdStr === '0' ||
        nameStr.includes('super admin') ||
        nameStr.includes('superadmin')
      );
    };

    const attMap = new Map();
    allAttendance.forEach((rec) => {
      let uid = null;
      if (typeof rec.user_id === 'object' && rec.user_id !== null) {
        if (isSuperUser(rec.user_id)) return;
        uid = rec.user_id.id || rec.user_id._id || (rec.user_id.toString ? rec.user_id.toString() : null);
      } else if (rec.user_id) {
        uid = rec.user_id.toString();
      }
      if (uid) attMap.set(String(uid), rec);
    });

    const validUsers = (allUsers || []).filter((u) => !isSuperUser(u));

    if (validUsers.length === 0) {
      return allAttendance
        .filter((rec) => {
          const uInfo = typeof rec.user_id === 'object' && rec.user_id !== null ? rec.user_id : {};
          return !isSuperUser(uInfo);
        })
        .map((rec) => {
          const uInfo = typeof rec.user_id === 'object' && rec.user_id !== null ? rec.user_id : {};
          return {
            id: rec.id || rec._id,
            userId: uInfo.id || uInfo._id || 'unknown',
            name: uInfo.name || 'Staff Member',
            email: uInfo.email || '',
            role: uInfo.role || 'Staff',
            department: uInfo.department || uInfo.designation || 'General',
            avatar: uInfo.avatar || uInfo.profile_image || null,
            checkIn: rec.check_in_time,
            checkOut: rec.check_out_time,
            workingHours: rec.working_hours || calculateWorkingHours(rec.check_in_time, rec.check_out_time, selectedDate),
            overtime: rec.overtime || '0.00',
            isLate: rec.is_late,
            status: rec.check_out_time ? (rec.is_late ? 'LATE' : 'COMPLETED') : (rec.check_in_time ? 'ACTIVE' : 'PRESENT')
          };
        });
    }

    return validUsers.map((user) => {
      const uid = String(user.id || user._id || '');
      const rec = attMap.get(uid);

      if (rec) {
        let hours = rec.working_hours || '0.00';
        let status = 'PRESENT';

        if (rec.check_in_time && !rec.check_out_time) {
          status = selectedDate === getISTDate() ? 'ACTIVE' : (rec.is_late ? 'LATE' : 'PRESENT');
          hours = calculateWorkingHours(rec.check_in_time, rec.check_out_time, selectedDate);
        } else if (rec.check_out_time) {
          status = rec.is_late ? 'LATE' : 'COMPLETED';
          hours = rec.working_hours || calculateWorkingHours(rec.check_in_time, rec.check_out_time, selectedDate);
        } else if (rec.is_late) {
          status = 'LATE';
        }

        return {
          id: rec.id || rec._id || uid,
          userId: uid,
          name: user.name || user.email || 'Staff Member',
          email: user.email || '',
          role: user.role || 'Employee',
          department: user.department || user.designation || 'General',
          avatar: user.avatar || user.profile_image || null,
          checkIn: rec.check_in_time,
          checkOut: rec.check_out_time,
          workingHours: hours,
          overtime: rec.overtime || '0.00',
          isLate: rec.is_late,
          status
        };
      }

      return {
        id: uid,
        userId: uid,
        name: user.name || user.email || 'Staff Member',
        email: user.email || '',
        role: user.role || 'Employee',
        department: user.department || user.designation || 'General',
        avatar: user.avatar || user.profile_image || null,
        checkIn: null,
        checkOut: null,
        workingHours: '0.00',
        overtime: '0.00',
        isLate: false,
        status: 'ABSENT'
      };
    });
  }, [allUsers, allAttendance, selectedDate]);

  // Filtered List
  const filteredAttendanceList = useMemo(() => {
    return mergedAttendanceList.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PRESENT') return item.checkIn !== null;
      if (statusFilter === 'LATE') return item.isLate === true;
      if (statusFilter === 'ACTIVE') return item.status === 'ACTIVE';
      if (statusFilter === 'ABSENT') return item.status === 'ABSENT';

      return true;
    });
  }, [mergedAttendanceList, searchQuery, statusFilter]);

  // Summary KPIs
  const summaryStats = useMemo(() => {
    const total = mergedAttendanceList.length;
    const present = mergedAttendanceList.filter((i) => i.checkIn !== null).length;
    const late = mergedAttendanceList.filter((i) => i.isLate).length;
    const active = mergedAttendanceList.filter((i) => i.status === 'ACTIVE').length;
    const absent = mergedAttendanceList.filter((i) => i.status === 'ABSENT').length;
    return { total, present, late, active, absent };
  }, [mergedAttendanceList]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0c10] flex items-center justify-center">
        <Loader2 className="text-indigo-500 animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 font-sans space-y-6">

          {/* SECTION HEADER, DATE SELECTOR & REFRESH */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-indigo-500" />
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Attendance Logs
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Viewing & saving daily attendance logs for staff for date: <strong className="text-indigo-600 dark:text-indigo-400">{selectedDate}</strong>
              </p>
            </div>

            {/* DATE SELECTOR INPUT & QUICK BUTTONS */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedDate(getISTDate())}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === getISTDate()
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedDate !== getISTDate()
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Yesterday
                </button>
              </div>

              {/* Native Date Input */}
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => fetchAllAttendanceLogs(selectedDate)}
                disabled={logsLoading}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
              >
                <RefreshCw size={14} className={logsLoading ? "animate-spin text-indigo-500" : "text-indigo-500"} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* SUMMARY KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Workforce</span>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{summaryStats.total}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present</span>
                <UserCheck size={14} className="text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{summaryStats.present}</span>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">In-Shift (Active)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{summaryStats.active}</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Late Entries</span>
                <Clock size={14} className="text-amber-500" />
              </div>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{summaryStats.late}</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/50 flex flex-col gap-1 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Not Checked In</span>
                <UserX size={14} className="text-rose-500" />
              </div>
              <span className="text-2xl font-black text-rose-700 dark:text-rose-300">{summaryStats.absent}</span>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { id: 'ALL', label: 'All Staff' },
                { id: 'PRESENT', label: 'Present' },
                { id: 'ACTIVE', label: 'In-Shift' },
                { id: 'LATE', label: 'Late' },
                { id: 'ABSENT', label: 'Absent' },
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ATTENDANCE LOGS TABLE */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Employee / Staff</th>
                  <th className="py-3.5 px-4">Login Time (In)</th>
                  <th className="py-3.5 px-4">Logout Time (Out)</th>
                  <th className="py-3.5 px-4">Working Hours</th>
                  <th className="py-3.5 px-4">Overtime</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {logsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading logs for {selectedDate}...
                    </td>
                  </tr>
                ) : filteredAttendanceList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <UserX className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      No logs found for {selectedDate} matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredAttendanceList.map((item) => {
                    return (
                      <tr key={item.id || item.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                              {item.avatar ? (
                                <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                item.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                <span>{item.department || 'General'}</span>
                                <span>•</span>
                                <span className="capitalize">{item.role}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Login Time (Check-In) */}
                        <td className="py-3.5 px-4 font-semibold">
                          {item.checkIn ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800/60">
                              <LogIn size={13} className="text-emerald-500" />
                              <span>{formatTime(item.checkIn)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">--</span>
                          )}
                        </td>

                        {/* Logout Time (Check-Out) */}
                        <td className="py-3.5 px-4 font-semibold">
                          {item.checkOut ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                              <LogOut size={13} className="text-slate-400" />
                              <span>{formatTime(item.checkOut)}</span>
                            </div>
                          ) : item.checkIn && selectedDate === getISTDate() ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800/60">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span>In-Shift (Active)</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">--</span>
                          )}
                        </td>

                        {/* Working Hours */}
                        <td className="py-3.5 px-4 font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          {item.checkIn ? `${item.workingHours} hrs` : <span className="text-slate-400">0.00 hrs</span>}
                        </td>

                        {/* Overtime */}
                        <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 font-mono">
                          {item.overtime && Number(item.overtime) > 0 ? `${item.overtime} hrs` : <span className="text-slate-400">0.00</span>}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {item.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          )}
                          {item.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                              Completed
                            </span>
                          )}
                          {item.status === 'LATE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              Late Entry
                            </span>
                          )}
                          {item.status === 'PRESENT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              Present
                            </span>
                          )}
                          {item.status === 'ABSENT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                              Not Checked In
                            </span>
                          )}
                        </td>

                        {/* Action: Log/Edit Date Record */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setEditingStaff(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Edit or log attendance for this date"
                          >
                            <Edit3 size={13} />
                            <span>Log/Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>


      {/* MARK / EDIT ATTENDANCE MODAL */}
      <MarkAttendanceModal
        isOpen={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        staff={editingStaff}
        targetDate={selectedDate}
        onSaveSuccess={() => {
          setSuccessMsg(`Attendance updated for ${editingStaff?.name} on ${selectedDate}!`);
          fetchAllAttendanceLogs(selectedDate);
          setTimeout(() => setSuccessMsg(null), 3000);
        }}
      />
    </div>
  );
};

const StatBlock = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm">
    <Icon size={18} className={`mb-4 ${color}`} />
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1">
      {label}
    </p>
    <p className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
      {value}
    </p>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
      {label}
    </p>
    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
      {value}
    </p>
  </div>
);

export default Attendance;