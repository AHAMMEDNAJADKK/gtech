// ==========================================
// FRONTEND: Attendance.jsx
// Minimal Personal Attendance Log In & Log Out Page
// ==========================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserX
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

// Minimalist Clock
const MinimalClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="text-center py-4">
      <p className="text-4xl sm:text-5xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        {timeString}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mt-1">
        Indian Standard Time (IST)
      </p>
    </div>
  );
};

const Attendance = () => {
  const currentUser = useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);

  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchPersonalStatus = useCallback(async () => {
    try {
      setLoading(true);
      const todayStr = getISTDate();
      const res = await fetch(`${API_BASE}/attendance/${todayStr}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        setTodayLog(null);
        return;
      }
      const data = await res.json();
      setTodayLog(data || null);
    } catch (err) {
      console.error("Fetch error:", err);
      setTodayLog(null);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchPersonalStatus();
  }, [fetchPersonalStatus]);

  const handlePunchAction = async (type) => {
    setPunchLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/attendance/${type}`, {
        method: 'POST',
        headers: getHeaders()
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || `Failed to ${type.replace('-', ' ')}.`);

      const text = type === 'check-in' ? 'Check-in recorded' : 'Check-out recorded';
      setSuccessMsg(`${text} successfully!`);

      await fetchPersonalStatus();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setPunchLoading(false);
    }
  };

  const liveWorkingHours = useMemo(() => {
    if (!todayLog?.check_in_time) return "0.00";
    if (todayLog?.check_out_time) {
      return calculateWorkingHours(todayLog.check_in_time, todayLog.check_out_time);
    }
    return calculateWorkingHours(todayLog.check_in_time, currentTime);
  }, [todayLog, currentTime]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 text-slate-800 dark:text-slate-200">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Attendance Log In / Log Out
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log in and log out your daily shift attendance
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
            {getISTDate()}
          </span>
        </div>
      </div>

      {/* ALERTS */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* PUNCH CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0 border border-indigo-200 dark:border-indigo-800 overflow-hidden">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser?.name?.substring(0, 2)?.toUpperCase() || 'ST'
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser?.name || 'Staff Member'}</h2>
              <p className="text-xs text-slate-400 font-normal">{currentUser?.department || currentUser?.designation || 'Staff'}</p>
            </div>
          </div>

          <div>
            {todayLog?.check_in_time && !todayLog?.check_out_time ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift
              </span>
            ) : todayLog?.check_out_time ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <CheckCircle2 size={13} /> Completed
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <UserX size={13} /> Not Checked In
              </span>
            )}
          </div>
        </div>

        <MinimalClock />

        <div className="flex flex-col items-center justify-center pt-2">
          {loading ? (
            <div className="py-4">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : !todayLog?.check_in_time ? (
            <button
              onClick={() => handlePunchAction('check-in')}
              disabled={punchLoading}
              className="w-full max-w-sm py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {punchLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              <span>Log In (Check In)</span>
            </button>
          ) : !todayLog?.check_out_time ? (
            <button
              onClick={() => handlePunchAction('check-out')}
              disabled={punchLoading}
              className="w-full max-w-sm py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {punchLoading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              <span>Log Out (Check Out)</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center max-w-sm w-full">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Shift Completed Today</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Check-in and check-out times logged.</p>
            </div>
          )}
        </div>
      </div>

      {/* SHIFT SUMMARY DETAILS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Check-In</span>
          <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
            {todayLog?.check_in_time ? formatTime(todayLog.check_in_time) : '---'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Check-Out</span>
          <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
            {todayLog?.check_out_time ? formatTime(todayLog.check_out_time) : '---'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Duration</span>
          <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {liveWorkingHours} hrs
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
          <span className="text-xs font-semibold">
            {todayLog?.is_late ? (
              <span className="text-amber-600 dark:text-amber-400">Late Arrival</span>
            ) : todayLog?.check_in_time ? (
              <span className="text-emerald-600 dark:text-emerald-400">On Time</span>
            ) : (
              <span className="text-slate-400">Pending</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Attendance;