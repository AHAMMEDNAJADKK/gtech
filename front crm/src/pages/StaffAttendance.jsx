// ==========================================
// FRONTEND: StaffAttendance.jsx
// Staff Attendance Roster Page
// ==========================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  LogIn,
  LogOut,
  Search,
  RefreshCw,
  Edit3,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper to get IST Date YYYY-MM-DD
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

// ==========================================
// MODAL: LOG / EDIT STAFF ATTENDANCE RECORD
// ==========================================
const MarkAttendanceModal = ({ isOpen, onClose, staff, targetDate, onSaveSuccess }) => {
  const [inTime, setInTime] = useState('09:30');
  const [outTime, setOutTime] = useState('18:00');
  const [status, setStatus] = useState('PRESENT');
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState(null);

  useEffect(() => {
    if (staff?.checkIn) {
      const d = parseAsUTC(staff.checkIn);
      if (d) setInTime(d.toTimeString().substring(0, 5));
    } else {
      setInTime('09:30');
    }

    if (staff?.checkOut) {
      const d = parseAsUTC(staff.checkOut);
      if (d) setOutTime(d.toTimeString().substring(0, 5));
    } else {
      setOutTime('18:00');
    }

    if (staff?.status) {
      if (staff.status === 'ABSENT') setStatus('ABSENT');
      else if (staff.status === 'LATE') setStatus('LATE');
      else setStatus('PRESENT');
    } else {
      setStatus('PRESENT');
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
        if (inTime) checkInISO = new Date(`${targetDate}T${inTime}:00`).toISOString();
        if (outTime) checkOutISO = new Date(`${targetDate}T${outTime}:00`).toISOString();
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
      if (!res.ok) throw new Error(data.detail || "Failed to save attendance record");

      onSaveSuccess();
      onClose();
    } catch (err) {
      setModalErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs mb-1">
            <UserCheck size={16} />
            <span>Mark Staff Attendance</span>
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
            Log Attendance Record
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Updating attendance for <strong className="text-indigo-600 dark:text-indigo-400">{staff.name}</strong> on <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{targetDate}</span>.
          </p>
        </div>

        {modalErr && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{modalErr}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Attendance Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="PRESENT">PRESENT (On Time)</option>
              <option value="LATE">LATE ENTRY</option>
              <option value="ABSENT">ABSENT / NOT CHECKED IN</option>
            </select>
          </div>

          {status !== 'ABSENT' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Check-In Time</label>
                <input
                  type="time"
                  value={inTime}
                  onChange={(e) => setInTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Check-Out Time</label>
                <input
                  type="time"
                  value={outTime}
                  onChange={(e) => setOutTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// ==========================================
// MAIN COMPONENT: STAFF ATTENDANCE ROSTER
// ==========================================
const StaffAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(getISTDate());
  const [allAttendance, setAllAttendance] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchData = useCallback(async (dateStr) => {
    try {
      setLoading(true);
      setErrorMsg(null);
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
      } else {
        setAllUsers([]);
      }
    } catch (err) {
      console.error("Error fetching staff attendance data:", err);
      setErrorMsg("Failed to load staff attendance data.");
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData(selectedDate);
    setSelectedStaffIds([]);
  }, [selectedDate, fetchData]);

  const departmentOptions = useMemo(() => {
    const depts = new Set();
    allUsers.forEach((u) => {
      const dName = u.department || u.departmentId?.name || u.designation;
      if (dName) depts.add(dName);
    });
    return Array.from(depts);
  }, [allUsers]);

  const mergedStaffList = useMemo(() => {
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
            employeeId: uInfo.employeeId || '---',
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
          employeeId: user.employeeId || user.emp_id || '---',
          role: user.role || 'Employee',
          department: user.department || user.departmentId?.name || user.designation || 'General',
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
        employeeId: user.employeeId || user.emp_id || '---',
        role: user.role || 'Employee',
        department: user.department || user.departmentId?.name || user.designation || 'General',
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

  const filteredRoster = useMemo(() => {
    return mergedStaffList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        String(item.employeeId).toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (deptFilter !== 'ALL' && item.department !== deptFilter) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PRESENT') return item.checkIn !== null || item.status === 'PRESENT' || item.status === 'COMPLETED';
      if (statusFilter === 'ACTIVE') return item.status === 'ACTIVE';
      if (statusFilter === 'LATE') return item.isLate === true || item.status === 'LATE';
      if (statusFilter === 'ABSENT') return item.status === 'ABSENT';

      return true;
    });
  }, [mergedStaffList, searchQuery, deptFilter, statusFilter]);

  const summaryStats = useMemo(() => {
    const total = mergedStaffList.length;
    const present = mergedStaffList.filter((i) => i.checkIn !== null || i.status === 'PRESENT' || i.status === 'COMPLETED' || i.status === 'ACTIVE').length;
    const active = mergedStaffList.filter((i) => i.status === 'ACTIVE').length;
    const late = mergedStaffList.filter((i) => i.isLate || i.status === 'LATE').length;
    const absent = mergedStaffList.filter((i) => i.status === 'ABSENT').length;
    return { total, present, active, late, absent };
  }, [mergedStaffList]);

  const quickMarkAttendance = async (staffItem, targetStatus) => {
    setActionLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const headers = getHeaders();
      let checkInISO = null;
      let checkOutISO = null;

      if (targetStatus === 'PRESENT') {
        checkInISO = new Date(`${selectedDate}T09:30:00`).toISOString();
        checkOutISO = new Date(`${selectedDate}T18:00:00`).toISOString();
      } else if (targetStatus === 'LATE') {
        checkInISO = new Date(`${selectedDate}T10:15:00`).toISOString();
        checkOutISO = new Date(`${selectedDate}T18:00:00`).toISOString();
      }

      const res = await fetch(`${API_BASE}/attendance/mark-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: staffItem.userId,
          date: selectedDate,
          status: targetStatus,
          check_in_time: checkInISO,
          check_out_time: checkOutISO,
          is_late: targetStatus === 'LATE'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to mark attendance.");

      setSuccessMsg(`Marked ${staffItem.name} as ${targetStatus}!`);
      fetchData(selectedDate);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkMark = async (targetStatus) => {
    if (selectedStaffIds.length === 0) return;
    setActionLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const headers = getHeaders();
      const promises = selectedStaffIds.map((userId) => {
        let checkInISO = null;
        let checkOutISO = null;

        if (targetStatus === 'PRESENT') {
          checkInISO = new Date(`${selectedDate}T09:30:00`).toISOString();
          checkOutISO = new Date(`${selectedDate}T18:00:00`).toISOString();
        } else if (targetStatus === 'LATE') {
          checkInISO = new Date(`${selectedDate}T10:15:00`).toISOString();
          checkOutISO = new Date(`${selectedDate}T18:00:00`).toISOString();
        }

        return fetch(`${API_BASE}/attendance/mark-user`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userId,
            date: selectedDate,
            status: targetStatus,
            check_in_time: checkInISO,
            check_out_time: checkOutISO,
            is_late: targetStatus === 'LATE'
          })
        });
      });

      await Promise.all(promises);
      setSuccessMsg(`Updated attendance for ${selectedStaffIds.length} staff members to ${targetStatus}!`);
      setSelectedStaffIds([]);
      fetchData(selectedDate);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg("Some records failed to update.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStaffIds.length === filteredRoster.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(filteredRoster.map((item) => item.userId));
    }
  };

  const toggleSelectStaff = (userId) => {
    setSelectedStaffIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const exportToExcel = () => {
    const dataToExport = filteredRoster.map((item) => ({
      'Employee ID': item.employeeId,
      'Staff Name': item.name,
      'Email': item.email,
      'Department': item.department,
      'Role': item.role,
      'Date': selectedDate,
      'Status': item.status,
      'Check-In Time': item.checkIn ? formatTime(item.checkIn) : 'N/A',
      'Check-Out Time': item.checkOut ? formatTime(item.checkOut) : 'N/A',
      'Working Hours': `${item.workingHours} hrs`,
      'Overtime': `${item.overtime} hrs`,
      'Is Late': item.isLate ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Attendance');
    XLSX.writeFile(workbook, `Staff_Attendance_${selectedDate}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-900/60 min-h-screen text-slate-800 dark:text-slate-200 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Staff Attendance Roster
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Mark, update, and manage daily staff attendance logs and shift records
              </p>
            </div>
          </div>
        </div>

        {/* DATE PICKER & ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              onClick={() => setSelectedDate(getISTDate())}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                selectedDate !== getISTDate()
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Yesterday
            </button>
          </div>

          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          <button
            onClick={() => fetchData(selectedDate)}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl transition cursor-pointer shrink-0 shadow-xs"
            title="Refresh logs"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-indigo-500" : "text-indigo-500"} />
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION TOASTS */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X size={16} />
          </button>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-extrabold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Staff</span>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">{summaryStats.total}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Present</span>
            <UserCheck size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">{summaryStats.present}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">In-Shift (Active)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">{summaryStats.active}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Late Entries</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">{summaryStats.late}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Not Checked In</span>
            <UserX size={16} className="text-rose-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">{summaryStats.absent}</p>
        </div>
      </div>

      {/* FILTER & BULK ACTIONS CONTROL BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by staff name, email, employee ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5">
              <Filter size={14} className="text-slate-400" />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedStaffIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black">
                {selectedStaffIds.length} Selected
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Bulk Action for {selectedDate}:</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkMark('PRESENT')}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <UserCheck size={14} /> Mark Selected Present
              </button>
              <button
                onClick={() => handleBulkMark('LATE')}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Clock size={14} /> Mark Selected Late
              </button>
              <button
                onClick={() => handleBulkMark('ABSENT')}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <UserX size={14} /> Mark Selected Absent
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* STAFF ATTENDANCE ROSTER TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-4 px-4 text-center w-10">
                  <button onClick={toggleSelectAll} className="cursor-pointer text-slate-400 hover:text-indigo-600">
                    {selectedStaffIds.length > 0 && selectedStaffIds.length === filteredRoster.length ? (
                      <CheckSquare size={16} className="text-indigo-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-4 px-4">Staff Member</th>
                <th className="py-4 px-4">Department / Role</th>
                <th className="py-4 px-4">Check-In Time</th>
                <th className="py-4 px-4">Check-Out Time</th>
                <th className="py-4 px-4">Working Hours</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-right">Attendance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                    <p className="font-bold text-xs">Loading staff attendance for {selectedDate}...</p>
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <UserX className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-bold text-xs">No staff members match your filters for {selectedDate}.</p>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => {
                  const isSelected = selectedStaffIds.includes(item.userId);
                  return (
                    <tr
                      key={item.id || item.userId}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => toggleSelectStaff(item.userId)} className="cursor-pointer text-slate-400">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-indigo-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden shadow-xs">
                            {item.avatar ? (
                              <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              item.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{item.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{item.department}</p>
                          <span className="text-[10px] text-slate-400 capitalize font-medium">{item.role}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold">
                        {item.checkIn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800/60">
                            <LogIn size={13} className="text-emerald-500" />
                            <span>{formatTime(item.checkIn)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">--:--</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold">
                        {item.checkOut ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                            <LogOut size={13} className="text-slate-400" />
                            <span>{formatTime(item.checkOut)}</span>
                          </div>
                        ) : item.checkIn && selectedDate === getISTDate() ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800/60">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>In-Shift</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">--:--</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {item.checkIn ? `${item.workingHours} hrs` : <span className="text-slate-400">0.00 hrs</span>}
                      </td>

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
                            Absent
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => quickMarkAttendance(item, 'PRESENT')}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-extrabold transition cursor-pointer border border-emerald-200 dark:border-emerald-800/60"
                            title="Quick mark Present"
                          >
                            Present
                          </button>
                          <button
                            onClick={() => quickMarkAttendance(item, 'ABSENT')}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-[11px] font-extrabold transition cursor-pointer border border-rose-200 dark:border-rose-800/60"
                            title="Quick mark Absent"
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => setEditingStaff(item)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 rounded-lg transition cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Log exact times and status"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MARK / EDIT STAFF ATTENDANCE MODAL */}
      <MarkAttendanceModal
        isOpen={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        staff={editingStaff}
        targetDate={selectedDate}
        onSaveSuccess={() => {
          setSuccessMsg(`Attendance record updated for ${editingStaff?.name}!`);
          fetchData(selectedDate);
          setTimeout(() => setSuccessMsg(null), 3000);
        }}
      />
    </div>
  );
};

export default StaffAttendance;
