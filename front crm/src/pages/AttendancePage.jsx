import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, LogIn, LogOut, ShieldCheck, User, Calendar, CheckCircle2, 
  AlertCircle, XCircle, Users, Activity, Sparkles, RefreshCw, 
  FileText, ArrowUpRight, Search, Filter, ChevronRight, Award
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const AttendancePage = () => {
  const { showToast } = useToast();

  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const userRole = (user.role || '').toLowerCase();
  const userRoleId = String(user.role_id || '');
  const isSuperAdmin = Boolean(user.isSuperAdmin || userRole === 'superadmin' || userRoleId === '0');
  const isHr = Boolean(userRole === 'hr' || userRoleId === '2');
  const isMentor = Boolean(
    userRole === 'mentor' || 
    userRole === 'instructor' || 
    userRoleId === '3' || 
    (user.designation || '').toLowerCase().includes('mentor') ||
    (user.designation || '').toLowerCase().includes('faculty')
  );
  const isStudent = Boolean(userRole === 'student' || userRoleId === '10');

  // Active Tab for Admin / HR: 'my-shift' or 'organization-records'
  const [activeTab, setActiveTab] = useState('my-shift');

  // Live IST Clock
  const [istTime, setIstTime] = useState('');
  const [istDateFormatted, setIstDateFormatted] = useState('');

  // Shift & Attendance state
  const [loadingShift, setLoadingShift] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [shiftData, setShiftData] = useState({
    isActiveShift: false,
    today: '',
    currentWorkingHours: '0.00',
    attendance: null
  });

  // History state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Admin / HR Organization Summary state
  const [orgDate, setOrgDate] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  });
  const [orgSummary, setOrgSummary] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Update IST Clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const dateStr = now.toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      setIstTime(timeStr);
      setIstDateFormatted(dateStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's shift info
  const fetchMyShift = useCallback(async () => {
    setLoadingShift(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/attendance/my-shift`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch active shift details.');
      const data = await res.json();
      setShiftData(data);
    } catch (err) {
      console.warn("Shift fetch fallback:", err.message);
    } finally {
      setLoadingShift(false);
    }
  }, [getHeaders]);

  // Fetch personal shift history
  const fetchMyHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/attendance/my-history?limit=15`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (err) {
      console.warn("Attendance history fetch fallback:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [getHeaders]);

  // Fetch Organization Attendance (for HR and Super Admin)
  const fetchOrgSummary = useCallback(async () => {
    if (!isSuperAdmin && !isHr) return;
    setLoadingOrg(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/attendance/summary?date=${orgDate}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOrgSummary(data);
      }
    } catch (err) {
      console.warn("Org summary fetch fallback:", err.message);
    } finally {
      setLoadingOrg(false);
    }
  }, [getHeaders, isSuperAdmin, isHr, orgDate]);

  useEffect(() => {
    fetchMyShift();
    fetchMyHistory();
  }, [fetchMyShift, fetchMyHistory]);

  useEffect(() => {
    if (activeTab === 'organization-records') {
      fetchOrgSummary();
    }
  }, [activeTab, fetchOrgSummary]);

  // Handle Check-in / Check-out action
  const handleShiftToggle = async () => {
    if (isStudent) {
      showToast('Student class attendance is tracked by course session.', 'info');
      return;
    }

    setSubmittingAction(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const isCheckingIn = !shiftData.attendance?.check_in_time;
      const endpoint = isCheckingIn ? `${base}/attendance/check-in` : `${base}/attendance/check-out`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders()
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || resData.message || 'Attendance action failed.');
      }

      showToast(
        isCheckingIn ? '🎉 Successfully Checked In! Shift Active.' : '👋 Successfully Checked Out! Have a great day.',
        'success'
      );

      await fetchMyShift();
      await fetchMyHistory();
      if (isSuperAdmin || isHr) {
        fetchOrgSummary();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const att = shiftData.attendance;
  const isCheckedIn = Boolean(att?.check_in_time);
  const isCheckedOut = Boolean(att?.check_out_time);
  const isShiftActive = isCheckedIn && !isCheckedOut;

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return '--:--';
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '--:--';
    }
  };

  const roleLabel = isSuperAdmin 
    ? 'Super Admin' 
    : isHr 
    ? 'HR Operations' 
    : isMentor 
    ? 'Faculty Mentor' 
    : 'Student';

  const userIdentifier = user.studentId || user.employeeId || (user.email ? user.email.split('@')[0] : 'ID-001');

  return (
    <div className="space-y-8 pb-12">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Clock size={13} className="text-indigo-400" /> Attendance Management System
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
            Attendance Log In / Log Out
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Indian Standard Time (IST) automated shift logging, duration calculation, and verified records.
          </p>
        </div>

        {/* Tab switch for Super Admin and HR */}
        {(isSuperAdmin || isHr) && (
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl self-start sm:self-auto shadow-inner">
            <button
              onClick={() => setActiveTab('my-shift')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'my-shift'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Shift Log
            </button>
            <button
              onClick={() => setActiveTab('organization-records')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'organization-records'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Organization Records
            </button>
          </div>
        )}
      </div>

      {activeTab === 'my-shift' ? (
        <div className="space-y-8">
          {/* MASTER DARK NAVY ATTENDANCE HERO CONTAINER (Screenshot matched) */}
          <div className="bg-[#0B132B] border border-slate-800/80 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden">
            {/* Subtle ambient background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Identity & Shift Status */}
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-1 shadow-lg">
                      {user.avatar || user.profile_image ? (
                        <img 
                          src={user.avatar || user.profile_image} 
                          alt={user.name} 
                          className="w-full h-full object-cover rounded-xl bg-slate-900"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl sm:text-2xl">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {isShiftActive && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0B132B] rounded-full animate-pulse" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {user.name || 'CRM Member'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      ID: {userIdentifier}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {roleLabel}
                      </span>
                      {user.department && (
                        <span className="text-[11px] text-slate-400">
                          • {user.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Shift Indicator Badge */}
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className={`w-3 h-3 rounded-full ${
                    isShiftActive ? 'bg-emerald-500 animate-ping' : isCheckedOut ? 'bg-blue-500' : 'bg-amber-500'
                  }`} />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Shift Status
                    </div>
                    <div className="text-xs font-bold text-white">
                      {isShiftActive ? 'Active Shift in Progress' : isCheckedOut ? 'Shift Completed for Today' : 'Not Checked In'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Prominent Digital Clock (IST) */}
              <div className="lg:col-span-4 text-center py-4 lg:border-x lg:border-slate-800/80 px-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                  <Clock size={13} className="text-indigo-400" /> Indian Standard Time (IST)
                </div>
                <div className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-300 tracking-wider my-2">
                  {istTime || '12:00:00 PM'}
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {istDateFormatted || 'Wednesday, October 14, 2026'}
                </div>
              </div>

              {/* Right Column: Large Action Button */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center">
                {isStudent ? (
                  <div className="text-center p-4 bg-slate-900/80 border border-slate-800 rounded-2xl w-full">
                    <Award size={32} className="mx-auto text-indigo-400 mb-2" />
                    <div className="text-xs font-bold text-white">Student Academic Log</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Class attendance is automatically registered during your live lectures.
                    </p>
                  </div>
                ) : isCheckedOut ? (
                  <div className="text-center w-full">
                    <button
                      disabled
                      className="w-full py-4 px-6 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm cursor-not-allowed border border-slate-700/60 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      Shift Completed
                    </button>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Total logged: {att?.working_hours || '0.00'} hrs
                    </p>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={submittingAction || loadingShift}
                    onClick={handleShiftToggle}
                    className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-3 transition-all ${
                      isShiftActive
                        ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/30 border border-rose-500/40'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-900/30 border border-emerald-400/30'
                    }`}
                  >
                    {submittingAction ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : isShiftActive ? (
                      <LogOut size={20} />
                    ) : (
                      <LogIn size={20} />
                    )}
                    <span>{isShiftActive ? 'LOG OUT / CHECK OUT' : 'LOG IN / CHECK IN'}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* SUMMARY CARDS (Screenshot matched 4-column layout) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80">
              {/* Card 1: Check-in */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Check-in</span>
                  <LogIn size={14} className="text-emerald-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  {formatTimeOnly(att?.check_in_time)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {att?.is_late ? '⚠️ Checked in late' : isCheckedIn ? '✓ On Time' : 'Waiting for log in'}
                </div>
              </div>

              {/* Card 2: Check-out */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Check-out</span>
                  <LogOut size={14} className="text-rose-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  {formatTimeOnly(att?.check_out_time)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {isShiftActive ? 'Shift currently active' : isCheckedOut ? '✓ Completed' : 'Pending'}
                </div>
              </div>

              {/* Card 3: Duration */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Duration</span>
                  <Clock size={14} className="text-cyan-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  {shiftData.currentWorkingHours || '0.00'} hrs
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Overtime: {att?.overtime || '0.00'} hrs
                </div>
              </div>

              {/* Card 4: Status */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Status</span>
                  <Activity size={14} className="text-indigo-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white">
                  {att?.status || (isCheckedIn ? 'PRESENT' : 'NOT MARKED')}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {isCheckedIn ? 'Attendance confirmed' : 'Requires login'}
                </div>
              </div>
            </div>
          </div>

          {/* ATTENDANCE HISTORY SECTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent Attendance Logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Server-verified records with check-in, check-out, and total calculated hours.
                </p>
              </div>
              <button
                onClick={fetchMyHistory}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-indigo-600" />
                <span className="text-xs text-slate-400">Loading history logs...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No past attendance records found yet. Check in above to create your first log!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Check-in</th>
                      <th className="py-3 px-4">Check-out</th>
                      <th className="py-3 px-4">Working Hours</th>
                      <th className="py-3 px-4">Overtime</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.map((record) => (
                      <tr key={record.id || record.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {record.date}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {formatTimeOnly(record.check_in_time)}
                          {record.is_late && (
                            <span className="ml-2 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              LATE
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {formatTimeOnly(record.check_out_time)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {record.working_hours || '0.00'} hrs
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {record.overtime || '0.00'} hrs
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            record.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {record.status || 'PRESENT'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ORGANIZATION ATTENDANCE TAB (For HR & Super Admin) */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organization Daily Attendance Overview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect employees, mentors, and staff shift records for any given day.
                </p>
              </div>

              {/* Date Filter & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={orgDate}
                  onChange={(e) => setOrgDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 w-48"
                  />
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {orgSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-indigo-500">Total Marked</span>
                  <div className="text-2xl font-black text-indigo-950 dark:text-indigo-200 mt-1">
                    {orgSummary.totalMarked || 0}
                  </div>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-emerald-500">Active Shifts</span>
                  <div className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-1">
                    {orgSummary.activeShifts || 0}
                  </div>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-blue-500">Completed Shifts</span>
                  <div className="text-2xl font-black text-blue-950 dark:text-blue-200 mt-1">
                    {orgSummary.completedShifts || 0}
                  </div>
                </div>
                <div className="bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-amber-500">Late Arrivals</span>
                  <div className="text-2xl font-black text-amber-950 dark:text-amber-200 mt-1">
                    {orgSummary.lateArrivals || 0}
                  </div>
                </div>
              </div>
            )}

            {/* Records Table */}
            {loadingOrg ? (
              <div className="py-16 text-center">
                <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto mb-2" />
                <span className="text-xs text-slate-400">Loading organization records...</span>
              </div>
            ) : !orgSummary || !orgSummary.records || orgSummary.records.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No attendance logs found for date: <strong className="text-slate-300">{orgDate}</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Role / Department</th>
                      <th className="py-3 px-4">Check-in</th>
                      <th className="py-3 px-4">Check-out</th>
                      <th className="py-3 px-4">Hours</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orgSummary.records
                      .filter(r => {
                        if (!orgSearch) return true;
                        const term = orgSearch.toLowerCase();
                        const userName = typeof r.user_id === 'object' ? r.user_id.name : '';
                        const userEmail = typeof r.user_id === 'object' ? r.user_id.email : '';
                        return userName.toLowerCase().includes(term) || userEmail.toLowerCase().includes(term);
                      })
                      .map((record) => {
                        const employeeObj = typeof record.user_id === 'object' ? record.user_id : {};
                        return (
                          <tr key={record.id || record.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {employeeObj.name || 'Staff Member'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {employeeObj.email || record.user_id}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {employeeObj.role || employeeObj.designation || 'Staff'}
                              </span>
                              {employeeObj.department && (
                                <div className="text-[10px] text-slate-400 mt-0.5">{employeeObj.department}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                              {formatTimeOnly(record.check_in_time)}
                              {record.is_late && (
                                <span className="ml-1.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                                  LATE
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                              {formatTimeOnly(record.check_out_time)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {record.working_hours || '0.00'} hrs
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                record.status === 'PRESENT'
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                              }`}>
                                {record.status || 'PRESENT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
