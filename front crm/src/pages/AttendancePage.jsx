import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, LogIn, LogOut, ShieldCheck, User, Calendar, CheckCircle2, 
  AlertCircle, XCircle, Users, Activity, Sparkles, RefreshCw, 
  FileText, ArrowUpRight, Search, Filter, ChevronRight, Award,
  BookOpen, AlertTriangle, UserCheck, UserX, Check
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

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Active Tab for Admin / HR / Mentor: 'my-shift' or 'organization-records'
  const [activeTab, setActiveTab] = useState(() => {
    return (tabParam === 'roster' || tabParam === 'organization-records') ? 'organization-records' : 'my-shift';
  });

  useEffect(() => {
    if (tabParam === 'roster' || tabParam === 'organization-records') {
      setActiveTab('organization-records');
    } else if (tabParam === 'shift' || tabParam === 'my-shift') {
      setActiveTab('my-shift');
    }
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'organization-records') {
      setSearchParams({ tab: 'roster' });
    } else {
      setSearchParams({});
    }
  };

  // Live IST Clock
  const [istTime, setIstTime] = useState('');
  const [istDateFormatted, setIstDateFormatted] = useState('');

  // Shift & Attendance state
  const [loadingShift, setLoadingShift] = useState(true);
  const [shiftError, setShiftError] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [shiftData, setShiftData] = useState({
    isActiveShift: false,
    today: '',
    currentWorkingHours: '0.00',
    attendance: null
  });

  const [history, setHistory] = useState([]);
  const [studentClasses, setStudentClasses] = useState([]);
  const [studentHistoryTab, setStudentHistoryTab] = useState('daily');
  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Daily Present / Absent Attendance Roster state
  const [rosterDate, setRosterDate] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  });
  const [rosterRole, setRosterRole] = useState('all');
  const [rosterStatus, setRosterStatus] = useState('ALL');
  const [rosterCourseId, setRosterCourseId] = useState('all');
  const [rosterBatchId, setRosterBatchId] = useState('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterData, setRosterData] = useState({
    summary: { totalEligible: 0, presentCount: 0, absentCount: 0, leaveCount: 0, attendanceRate: 0 },
    filterOptions: { courses: [], batches: [], roles: ['all', 'student', 'mentor', 'hr'] },
    records: []
  });
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState(null);

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

  // Safe default shift state
  const DEFAULT_SHIFT = {
    isActiveShift: false,
    today: '',
    currentWorkingHours: '0.00',
    attendance: null
  };

  // Fetch today's shift info
  const fetchMyShift = useCallback(async () => {
    setLoadingShift(true);
    setShiftError(null);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/attendance/my-shift`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch active shift details.');
      const data = await res.json();
      if (data && typeof data === 'object') {
        setShiftData({
          isActiveShift: Boolean(data.isActiveShift),
          today: data.today || '',
          currentWorkingHours: data.currentWorkingHours || '0.00',
          attendance: data.attendance || null
        });
      } else {
        setShiftData(DEFAULT_SHIFT);
      }
    } catch (err) {
      console.warn("Shift fetch fallback:", err.message);
      setShiftError(err.message || 'Could not retrieve today’s shift.');
      setShiftData(prev => prev || DEFAULT_SHIFT);
    } finally {
      setLoadingShift(false);
    }
  }, [getHeaders]);

  // Fetch personal shift / student class history
  const fetchMyHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/attendance/my-history?limit=30`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = (data && data.data) ? data.data : (Array.isArray(data) ? data : []);
        setHistory(Array.isArray(list) ? list : []);
        if (data && Array.isArray(data.studentClasses)) {
          setStudentClasses(data.studentClasses);
        }
      } else {
        setHistory([]);
        setStudentClasses([]);
      }
    } catch (err) {
      console.warn("Attendance history fetch fallback:", err.message);
      setHistoryError(err.message || 'Could not load attendance history.');
      setHistory([]);
      setStudentClasses([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [getHeaders]);

  // Fetch Daily Attendance Roster (for Super Admin, HR, and Mentors within authorized scope)
  const fetchRoster = useCallback(async () => {
    if (isStudent) return;
    setLoadingRoster(true);
    setRosterError(null);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const queryParams = new URLSearchParams({
        date: rosterDate,
        role: rosterRole,
        status: rosterStatus,
        courseId: rosterCourseId,
        batchId: rosterBatchId,
        search: rosterSearch
      });

      const res = await fetch(`${base}/attendance/roster?${queryParams.toString()}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to fetch attendance roster.');
      }

      const data = await res.json();
      setRosterData(data);
    } catch (err) {
      console.warn("Roster fetch fallback:", err.message);
      setRosterError(err.message || 'Could not load attendance roster.');
    } finally {
      setLoadingRoster(false);
    }
  }, [getHeaders, isStudent, rosterDate, rosterRole, rosterStatus, rosterCourseId, rosterBatchId, rosterSearch]);

  useEffect(() => {
    fetchMyShift();
    fetchMyHistory();
  }, [fetchMyShift, fetchMyHistory]);

  useEffect(() => {
    if (activeTab === 'organization-records' && !isStudent) {
      fetchRoster();
    }
  }, [activeTab, isStudent, fetchRoster]);

  // Handle Check-in / Check-out action
  const handleShiftToggle = async () => {
    setSubmittingAction(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const isCheckingIn = !shiftData?.attendance?.check_in_time;
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
        isCheckingIn ? '🎉 Successfully Checked In! Attendance Active.' : '👋 Successfully Checked Out! Have a great day.',
        'success'
      );

      if (!isCheckingIn && resData) {
        setCheckoutSummary({
          date: resData.date || shiftData?.today,
          checkIn: resData.check_in_time || shiftData?.attendance?.check_in_time,
          checkOut: resData.check_out_time || new Date().toISOString(),
          workingHours: resData.working_hours || '0.00',
          overtime: resData.overtime || '0.00',
          status: resData.status || 'PRESENT'
        });
      }

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

  const att = shiftData?.attendance;
  const isCheckedIn = Boolean(att?.check_in_time);
  const isCheckedOut = Boolean(att?.check_out_time);
  const isShiftActive = isCheckedIn && !isCheckedOut;

  // Student class attendance metrics
  const classesList = isStudent && studentClasses.length > 0 ? studentClasses : (isStudent ? [] : history);
  const studentTotalClasses = classesList.length;
  const studentAttendedClasses = history.filter(h => h.status === 'PRESENT' || h.status === 'LATE').length;
  const studentAbsentClasses = history.filter(h => h.status === 'ABSENT').length;
  const studentAttendanceRate = studentTotalClasses > 0
    ? Math.round((studentAttendedClasses / studentTotalClasses) * 100)
    : 0;

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

        {/* Tab switch for Super Admin, HR, and Mentors */}
        {(isSuperAdmin || isHr || isMentor) && (
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl self-start sm:self-auto shadow-inner">
            <button
              onClick={() => handleTabChange('my-shift')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'my-shift'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Shift Log
            </button>
            <button
              onClick={() => handleTabChange('organization-records')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'organization-records'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isMentor && !isSuperAdmin && !isHr ? 'Batch Attendance Roster' : 'Daily Present / Absent List'}
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
                {isCheckedOut ? (
                  <div className="text-center w-full">
                    <button
                      disabled
                      className="w-full py-4 px-6 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm cursor-not-allowed border border-slate-700/60 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      {isStudent ? 'Attendance Completed' : 'Shift Completed'}
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
                    className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer ${
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
                    <span>{isShiftActive ? (isStudent ? 'CHECK OUT' : 'LOG OUT / CHECK OUT') : (isStudent ? 'CHECK IN' : 'LOG IN / CHECK IN')}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* SUMMARY CARDS (Unified Check-in, Check-out, Duration, Status) */}
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
                  {isShiftActive ? 'Session currently active' : isCheckedOut ? '✓ Completed' : 'Pending'}
                </div>
              </div>

              {/* Card 3: Duration */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Duration</span>
                  <Clock size={14} className="text-cyan-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  {shiftData?.currentWorkingHours || '0.00'} hrs
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {isStudent ? 'Total active session' : `Overtime: ${att?.overtime || '0.00'} hrs`}
                </div>
              </div>

              {/* Card 4: Status */}
              <div className="bg-slate-900/80 border border-slate-800/70 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Daily Status</span>
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

            {/* Student Lecture Attendance Overview Banner */}
            {isStudent && studentTotalClasses > 0 && (
              <div className="mt-4 p-3.5 bg-indigo-950/40 border border-indigo-800/50 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <BookOpen size={16} />
                  <span>Academic Class Attendance:</span>
                  <span className="text-white font-bold">{studentAttendedClasses} / {studentTotalClasses} Lectures Attended</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">{studentAbsentClasses} Missed</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    studentAttendanceRate >= 75 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {studentAttendanceRate}% Rate ({studentAttendanceRate >= 75 ? 'Good Standing' : 'Below 75%'})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ATTENDANCE HISTORY SECTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isStudent
                    ? (studentHistoryTab === 'classes' ? 'Class Lecture Records' : 'Daily Attendance & Session Logs')
                    : 'Recent Attendance Logs'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isStudent
                    ? (studentHistoryTab === 'classes' ? 'Verified course and batch lecture attendance history.' : 'Verified daily check-in, check-out, and active duration logs.')
                    : 'Server-verified records with check-in, check-out, and total calculated hours.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isStudent && (
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setStudentHistoryTab('daily')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        studentHistoryTab === 'daily'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Daily Logs
                    </button>
                    <button
                      onClick={() => setStudentHistoryTab('classes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        studentHistoryTab === 'classes'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Lectures ({studentClasses.length})
                    </button>
                  </div>
                )}
                <button
                  onClick={fetchMyHistory}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-indigo-600" />
                <span className="text-xs text-slate-400">Loading history logs...</span>
              </div>
            ) : historyError ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs text-rose-500 font-medium">{historyError}</p>
                <button
                  onClick={fetchMyHistory}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Retry Loading
                </button>
              </div>
            ) : isStudent && studentHistoryTab === 'classes' ? (
              studentClasses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No class lecture attendance records recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Course</th>
                        <th className="py-3 px-4">Batch</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {studentClasses.map((record) => (
                        <tr key={record.id || record._id || record.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                            {record.date}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {record.courseName || record.courseId?.courseName || 'Course Session'}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400">
                            {record.batchName || record.batchId?.batchName || 'General'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              record.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : record.status === 'LATE'
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}>
                              {record.status || 'UNMARKED'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                            {record.markedAt ? new Date(record.markedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
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
        /* ORGANIZATION / BATCH ATTENDANCE ROSTER (For HR, Super Admin & Mentors) */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 mb-2">
                  <UserCheck size={13} /> Daily Attendance & Verification Roster
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {isMentor && !isSuperAdmin && !isHr ? 'Batch Attendance & Verification Roster' : 'Organization Attendance & Verification Roster'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Automated Present / Absent tracking generated from student logins, course enrollments, and employee shift records.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchRoster()}
                  disabled={loadingRoster}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Refresh live attendance roster"
                >
                  <RefreshCw size={14} className={loadingRoster ? 'animate-spin text-indigo-500' : 'text-slate-500'} />
                  Refresh
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Eligible */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Eligible</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Users size={15} />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {rosterData?.summary?.totalEligible ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Active enrolled students & staff
                </div>
              </div>

              {/* Present */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-4.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={15} />
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-950 dark:text-emerald-200 mt-2">
                  {rosterData?.summary?.presentCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                  {rosterData?.summary?.attendanceRate ?? 0}% verified present
                </div>
              </div>

              {/* Absent */}
              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/50 rounded-2xl p-4.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Absent</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <XCircle size={15} />
                  </div>
                </div>
                <div className="text-3xl font-black text-rose-950 dark:text-rose-200 mt-2">
                  {rosterData?.summary?.absentCount ?? 0}
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-medium">
                  {(rosterData?.summary?.totalEligible ?? 0) > 0 
                    ? Math.round(((rosterData?.summary?.absentCount ?? 0) / rosterData.summary.totalEligible) * 100) 
                    : 0}% pending/absent today
                </div>
              </div>

              {/* Attendance Rate */}
              <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl p-4.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Attendance Rate</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={15} />
                  </div>
                </div>
                <div className="text-3xl font-black text-indigo-950 dark:text-indigo-200 mt-2">
                  {rosterData?.summary?.attendanceRate ?? 0}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, rosterData?.summary?.attendanceRate ?? 0))}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Filter Bar & Quick Status Tabs */}
            <div className="space-y-4 mb-6">
              {/* Quick Status Selection Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRosterStatus('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rosterStatus === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All Eligible ({rosterData?.summary?.totalEligible ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterStatus('PRESENT')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rosterStatus === 'PRESENT'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Present ({rosterData?.summary?.presentCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterStatus('ABSENT')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rosterStatus === 'ABSENT'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Absent ({rosterData?.summary?.absentCount ?? 0})
                </button>
              </div>

              {/* Comprehensive Dropdown & Search Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Date Picker */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Attendance Date
                  </label>
                  <input
                    type="date"
                    value={rosterDate}
                    onChange={(e) => setRosterDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 2. Role Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Role Filter
                  </label>
                  <select
                    value={rosterRole}
                    onChange={(e) => setRosterRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="student">Students</option>
                    {(!isMentor || isSuperAdmin || isHr) && (
                      <>
                        <option value="mentor">Mentors</option>
                        <option value="hr">HR Operations</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Course Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Course Filter
                  </label>
                  <select
                    value={rosterCourseId}
                    onChange={(e) => setRosterCourseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Courses</option>
                    {(rosterData?.filterOptions?.courses || []).map(c => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.courseName || c.title} {c.courseCode ? `(${c.courseCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Batch Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Batch Filter
                  </label>
                  <select
                    value={rosterBatchId}
                    onChange={(e) => setRosterBatchId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Batches</option>
                    {(rosterData?.filterOptions?.batches || []).map(b => (
                      <option key={b.id || b._id} value={b.id || b._id}>
                        {b.batchName || b.name} {b.batchCode ? `(${b.batchCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Search Bar */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Search Name / ID
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name or ID..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {rosterError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{rosterError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchRoster()}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Roster Table */}
            {loadingRoster ? (
              <div className="py-20 text-center">
                <RefreshCw size={30} className="animate-spin text-indigo-600 mx-auto mb-3" />
                <span className="text-xs text-slate-400 font-medium">Verifying and loading daily attendance roster...</span>
              </div>
            ) : !rosterData?.records || rosterData.records.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Users size={22} />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No attendance records found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No active eligible students or employees matched your selected date ({rosterDate}) or filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Student / Employee</th>
                      <th className="py-3.5 px-4">ID (Student / Emp)</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Course & Batch / Dept</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Check-in Time</th>
                      <th className="py-3.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rosterData.records.map((record) => {
                      const isPresent = record.status === 'PRESENT';
                      const roleUpper = (record.roleLabel || record.role || '').toUpperCase();

                      return (
                        <tr 
                          key={record.id} 
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Name & Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {record.avatar ? (
                                <img
                                  src={record.avatar}
                                  alt={record.name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-xs border border-indigo-200 dark:border-indigo-800/50">
                                  {record.name ? record.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {record.name || 'Anonymous User'}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {record.email || 'No email provided'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Identifier / ID Badge */}
                          <td className="py-3.5 px-4 font-mono">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {record.studentId || record.employeeId || record.identifier || 'N/A'}
                            </span>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              record.role === 'student'
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
                                : record.role === 'mentor' || roleUpper.includes('MENTOR')
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                                : record.role === 'hr' || roleUpper.includes('HR')
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            }`}>
                              {record.roleLabel || record.role}
                            </span>
                          </td>

                          {/* Course & Batch or Department */}
                          <td className="py-3.5 px-4">
                            {record.role === 'student' ? (
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {record.courseName || 'Course'}
                                </div>
                                {record.batchName && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mt-0.5 border border-slate-200/60 dark:border-slate-700/60">
                                    {record.batchName} {record.batchCode ? `(${record.batchCode})` : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {record.department || 'Operations'}
                                </div>
                                {record.designation && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">{record.designation}</div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Attendance Date */}
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {record.date}
                          </td>

                          {/* Check-in Time */}
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {record.checkInTime ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {formatTimeOnly(record.checkInTime)}
                                </span>
                                {record.isLate && (
                                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                    LATE
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">--:--</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                                Present
                              </span>
                            ) : record.status === 'LEAVE' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                <AlertCircle size={13} className="text-amber-600 dark:text-amber-400" />
                                On Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                                <XCircle size={13} className="text-rose-600 dark:text-rose-400" />
                                Absent
                              </span>
                            )}
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

      {/* Checkout Session Summary Modal */}
      {checkoutSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Session Completed
                </h3>
                <p className="text-xs text-slate-400">Attendance successfully logged</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5 text-xs mb-6">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Date:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{checkoutSummary.date}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Check-in Time:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{formatTimeOnly(checkoutSummary.checkIn)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Check-out Time:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{formatTimeOnly(checkoutSummary.checkOut)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700/60 pt-2 font-bold">
                <span>Total Duration:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">{checkoutSummary.workingHours} hrs</span>
              </div>
            </div>

            <button
              onClick={() => setCheckoutSummary(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs transition-all shadow-md cursor-pointer"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
