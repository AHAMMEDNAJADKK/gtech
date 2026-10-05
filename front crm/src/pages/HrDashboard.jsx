import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Activity, UserCheck, UserMinus, BarChart3,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Layout, RefreshCw, Eye, PieChart,
  Loader2, Calendar, FileText, Check, X, ArrowRight, Search, Briefcase, Building,
  ShieldCheck, UserPlus, Award, Sparkles, ChevronRight, Zap, ListTodo
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

const rawApiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase : `${rawApiBase}/v1`;

const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getWorkHours = (record) => {
  if (!record || !record.check_in_time) return '0.00 hrs';
  
  const start = new Date(record.check_in_time);
  const end = record.check_out_time ? new Date(record.check_out_time) : new Date();
  
  const diffMs = end - start;
  const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
  return `${diffHrs.toFixed(2)} hrs`;
};

// Admin Dashboard Style StatCard
const StatCard = ({ label, value, icon: Icon, color, borderColor, bgColor, subtext, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-indigo-500/50 hover:shadow-md' : ''}`}
  >
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className={`p-2.5 rounded-2xl ${bgColor} ${color}`}>
        <Icon size={18} />
      </div>
    </div>
    <div>
      <h3 className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
        {value}
      </h3>
      {subtext && (
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
          {subtext}
        </p>
      )}
    </div>
  </div>
);

// Minimal SVG Doughnut Chart Component
const DoughnutChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
      {total === 0 ? (
        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">No tasks</div>
      ) : (
        <>
          <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
            {data.map((item) => {
              if (item.value === 0) return null;
              const percent = item.value / total;
              const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
              cumulativePercent += percent;
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
              const largeArcFlag = percent > 0.5 ? 1 : 0;
              
              if (percent === 1) {
                return (
                  <circle
                    key={item.label}
                    cx="0"
                    cy="0"
                    r="0.8"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="0.28"
                    className="transition-all duration-500"
                  />
                );
              }

              const pathData = [
                `M ${startX * 0.8} ${startY * 0.8}`,
                `A 0.8 0.8 0 ${largeArcFlag} 1 ${endX * 0.8} ${endY * 0.8}`
              ].join(' ');

              return (
                <path
                  key={item.label}
                  d={pathData}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="0.28"
                  className="transition-all duration-300 hover:stroke-[0.32] cursor-pointer"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">{total}</span>
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Tasks</span>
          </div>
        </>
      )}
    </div>
  );
};

export default function HrDashboard() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [recruitment, setRecruitment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [leaveSubmittingId, setLeaveSubmittingId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  const navigate = useNavigate();
  const { showToast } = useToast();

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '').trim() : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();

      // Fetch users
      const usersRes = await fetch(`${API_BASE}/users/list`, { headers });
      const usersData = usersRes.ok ? await usersRes.json() : [];
      
      // Fetch tasks
      const tasksRes = await fetch(`${API_BASE}/tasks/all`, { headers });
      const tasksData = tasksRes.ok ? await tasksRes.json() : [];

      // Fetch today's attendance
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const attRes = await fetch(`${API_BASE}/attendance/all/${todayStr}`, { headers });
      const attData = attRes.ok ? await attRes.json() : [];

      // Fetch leave requests for HR
      const leavesRes = await fetch(`${API_BASE}/leaves/all?status=PENDING`, { headers });
      const leavesData = leavesRes.ok ? await leavesRes.json() : [];

      // Fetch recruitment pipeline candidates
      const recruitRes = await fetch(`${API_BASE}/recruitment`, { headers });
      const recruitData = recruitRes.ok ? await recruitRes.json() : [];

      setUsers(Array.isArray(usersData) ? usersData : (usersData.data || []));
      setTasks(Array.isArray(tasksData) ? tasksData : (tasksData.data || []));
      setAttendance(Array.isArray(attData) ? attData : []);
      setLeaves(leavesData.success ? (leavesData.data || []) : (Array.isArray(leavesData) ? leavesData : []));
      setRecruitment(recruitData.success ? (recruitData.data || []) : (Array.isArray(recruitData) ? recruitData : []));
    } catch (error) {
      console.error('Error fetching HR Dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Quick Leave Action
  const handleQuickLeaveAction = async (leaveId, action) => {
    setLeaveSubmittingId(leaveId);
    try {
      const res = await fetch(`${API_BASE}/leaves/${leaveId}/action`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action,
          comment: `Actioned directly via HR Command Center`,
          approvalType: 'hr'
        })
      });
      const data = await res.json();
      if (data.success) {
        setLeaves(prev => prev.filter(l => l._id !== leaveId));
        showToast(`Leave request ${action.toLowerCase()}ed successfully!`, 'success');
      } else {
        showToast(data.message || `Failed to ${action.toLowerCase()} leave request.`, 'error');
      }
    } catch (err) {
      console.error(`Error in leave ${action}:`, err);
    } finally {
      setLeaveSubmittingId(null);
    }
  };

  // Compute Online/Offline stats
  const userStats = useMemo(() => {
    const isSuperUser = (u) => {
      if (!u) return false;
      const roleStr = String(u.role || u.role_id || u.roleId || '').toLowerCase().trim();
      const nameStr = String(u.name || '').toLowerCase().trim();
      return (
        u.isSuperAdmin === true ||
        u.is_super_admin === true ||
        roleStr === 'superadmin' ||
        roleStr === 'super admin' ||
        roleStr === '0' ||
        nameStr.includes('super admin') ||
        nameStr.includes('superadmin')
      );
    };

    const getUserIdStr = (userObjOrId) => {
      if (!userObjOrId) return null;
      if (typeof userObjOrId === 'object') {
        return String(userObjOrId._id || userObjOrId.id || '');
      }
      return String(userObjOrId);
    };

    // Filter active staff members excluding SuperAdmins
    const validStaff = (users || []).filter(u => {
      if (!u) return false;
      if (isSuperUser(u)) return false;
      const isInactive = u.isActive === false || u.status === 'inactive' || u.status === 'deactivated';
      return !isInactive;
    });

    // Extract checked-in user IDs from attendance records
    const attendanceMap = new Map();
    (attendance || []).forEach(rec => {
      const uId = getUserIdStr(rec.user_id);
      if (uId && rec.check_in_time) {
        attendanceMap.set(uId, rec);
      }
    });

    let online = [];
    let offline = [];

    validStaff.forEach(u => {
      const uId = getUserIdStr(u);
      const attRecord = attendanceMap.get(uId);
      const isOnline = !!attRecord;
      const userWithAtt = { ...u, attendanceRecord: attRecord };

      if (isOnline) {
        online.push(userWithAtt);
      } else {
        offline.push(userWithAtt);
      }
    });

    return { online, offline, total: validStaff.length };
  }, [users, attendance]);

  // Compute Task Performance per User
  const performanceStats = useMemo(() => {
    const userTaskMap = {};

    tasks.forEach(t => {
      const uId = t.assigned_to?._id || t.assigned_to?.id || (typeof t.assigned_to === 'string' ? t.assigned_to : null);
      const uName = t.assigned_to?.name || 'Unassigned';
      if (!uId || typeof uId !== 'string') return;

      if (!userTaskMap[uId]) {
        userTaskMap[uId] = {
          id: uId,
          name: uName,
          total: 0,
          pending: 0,
          current: 0,
          preview: 0,
          done: 0
        };
      }
      
      userTaskMap[uId].total += 1;
      if (t.status === 'pending') userTaskMap[uId].pending += 1;
      else if (t.status === 'current') userTaskMap[uId].current += 1;
      else if (t.status === 'preview') userTaskMap[uId].preview += 1;
      else if (t.status === 'done') userTaskMap[uId].done += 1;
      else userTaskMap[uId].pending += 1;
    });

    return Object.values(userTaskMap).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [tasks]);

  // Company Workload Doughnut Data
  const companyWorkloadData = useMemo(() => {
    let counts = { pending: 0, current: 0, preview: 0, done: 0 };
    tasks.forEach(t => {
      if (counts[t.status] !== undefined) {
        counts[t.status] += 1;
      } else {
        counts.pending += 1;
      }
    });

    return [
      { label: 'Pending', value: counts.pending, color: '#94a3b8', bgClass: 'bg-slate-400' },
      { label: 'Current', value: counts.current, color: '#3b82f6', bgClass: 'bg-blue-500' },
      { label: 'Preview', value: counts.preview, color: '#f59e0b', bgClass: 'bg-amber-500' },
      { label: 'Done', value: counts.done, color: '#10b981', bgClass: 'bg-emerald-500' }
    ];
  }, [tasks]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-24 pt-4 max-w-7xl mx-auto px-4 font-sans">
      
      {/* ADMIN DASHBOARD STYLE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tighter">
            <span className="text-indigo-600 dark:text-indigo-400">HR</span> Command Center
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Workforce availability, leave approvals, recruitment pipeline & operational task performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/leaves')}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 transition-all shadow-sm cursor-pointer"
          >
            <Calendar size={14} className="text-amber-500" />
            <span>Leaves</span>
            {leaves.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black">{leaves.length}</span>
            )}
          </button>

          <button
            onClick={() => navigate('/recruitment')}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 transition-all shadow-sm cursor-pointer"
          >
            <UserPlus size={14} className="text-purple-500" />
            <span>Recruitment</span>
            {recruitment.length > 0 && (
              <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-black">{recruitment.length}</span>
            )}
          </button>

          <button
            onClick={() => navigate('/payslips')}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 transition-all shadow-sm cursor-pointer"
          >
            <FileText size={14} className="text-emerald-500" />
            <span>Payslips</span>
          </button>

          <button
            onClick={fetchData}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-500/50 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <div className="px-4 py-2.5 bg-indigo-600/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
          </div>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100 dark:border-slate-800/80">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? "bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => navigate('/staff-attendance')}
          className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
        >
          Staff Attendance
        </button>

        <button
          onClick={() => navigate('/leaves')}
          className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
        >
          Leave Management
        </button>

        <button
          onClick={() => navigate('/recruitment')}
          className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
        >
          Recruitment Pipeline
        </button>

        <button
          onClick={() => navigate('/hr-report')}
          className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
        >
          Daily HR Report
        </button>
      </div>

      {/* METRICS GRID (ADMIN STYLE 5-CARD GRID) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <StatCard
          label="Total Active Staff"
          value={loading ? '...' : userStats.total}
          icon={Users}
          color="text-indigo-600 dark:text-indigo-400"
          bgColor="bg-indigo-50 dark:bg-indigo-950/40"
          subtext="Registered Staff Members"
          onClick={() => navigate('/staff-attendance')}
        />

        <StatCard
          label="Checked In Today"
          value={loading ? '...' : userStats.online.length}
          icon={UserCheck}
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-50 dark:bg-emerald-950/40"
          subtext="Active Duty Staff"
          onClick={() => navigate('/staff-attendance')}
        />

        <StatCard
          label="Pending Leaves"
          value={loading ? '...' : leaves.length}
          icon={Calendar}
          color="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-50 dark:bg-amber-950/40"
          subtext="Stage 2 HR Approval Needed"
          onClick={() => navigate('/leaves')}
        />

        <StatCard
          label="Recruitment"
          value={loading ? '...' : recruitment.length}
          icon={UserPlus}
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-50 dark:bg-purple-950/40"
          subtext="Active Hiring Candidates"
          onClick={() => navigate('/recruitment')}
        />

        <StatCard
          label="Tasks Completed"
          value={loading ? '...' : tasks.filter(t => t.status === 'done').length}
          icon={CheckCircle2}
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-50 dark:bg-blue-950/40"
          subtext="Tasks Completed Today"
        />
      </div>

      {/* MAIN CONTENT SECTION (ADMIN DASHBOARD ROUNDED-[2.5rem] CARDS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          
          {/* Stage-2 HR Quick Leave Approvals Queue */}
          {leaves.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    Pending Leave Requests (Stage 2 Review)
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                    Requires final HR authorization
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-0.5 rounded-full font-mono">
                  {leaves.length} Pending
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {leaves.map((leave) => (
                  <div key={leave._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">{leave.userName || 'Employee'}</span>
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-md font-bold text-[10px] border border-indigo-200 dark:border-indigo-500/20 uppercase tracking-wider">
                          {leave.leaveType}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ({leave.totalDays} Day{leave.totalDays > 1 ? 's' : ''})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        📅 {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ➔ {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {leave.department ? ` • Dept: ${leave.department}` : ''}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 italic text-[11px] bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        "{leave.reason}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleQuickLeaveAction(leave._id, 'REJECTED')}
                        disabled={leaveSubmittingId === leave._id}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleQuickLeaveAction(leave._id, 'APPROVED')}
                        disabled={leaveSubmittingId === leave._id}
                        className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
                      >
                        {leaveSubmittingId === leave._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performers Ranking (Admin Style Section Card) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Award className="text-indigo-600 dark:text-indigo-400" size={18} /> Staff Task Performance Ranking
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                  Task volume & status breakdown per employee
                </p>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-xs bg-slate-400" />Pending</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-xs bg-blue-500" />Current</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-xs bg-amber-500" />Preview</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />Done</div>
              </div>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-xs font-bold">
                  <Loader2 size={20} className="animate-spin text-indigo-500" />
                  <span>Loading performance metrics...</span>
                </div>
              ) : performanceStats.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold">No task data recorded</div>
              ) : (
                performanceStats.map((stat, idx) => {
                  const pendingPct = (stat.pending / stat.total) * 100;
                  const currentPct = (stat.current / stat.total) * 100;
                  const previewPct = (stat.preview / stat.total) * 100;
                  const donePct = (stat.done / stat.total) * 100;

                  return (
                    <div key={stat.id} className="relative group">
                      <div className="flex justify-between items-end mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 dark:text-slate-500 w-4 font-mono">{idx + 1}.</span>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{stat.name}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-slate-400 hidden sm:inline-block text-[10px]">
                            {stat.pending} Pending • {stat.current} Current • {stat.preview} Preview • {stat.done} Done
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg text-slate-700 dark:text-slate-200 font-mono text-[11px] border border-slate-200 dark:border-slate-700 font-black">{stat.total} Total</span>
                        </div>
                      </div>
                      
                      {/* Segmented Progress Bar Track */}
                      <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full flex overflow-hidden group-hover:h-3.5 transition-all duration-300 border border-slate-200/60 dark:border-slate-800">
                        {stat.pending > 0 && (
                          <div style={{ width: `${pendingPct}%` }} title={`${stat.pending} Pending`} className="bg-slate-400 cursor-pointer hover:brightness-110" />
                        )}
                        {stat.current > 0 && (
                          <div style={{ width: `${currentPct}%` }} title={`${stat.current} Current`} className="bg-blue-500 cursor-pointer hover:brightness-110" />
                        )}
                        {stat.preview > 0 && (
                          <div style={{ width: `${previewPct}%` }} title={`${stat.preview} Preview`} className="bg-amber-500 cursor-pointer hover:brightness-110" />
                        )}
                        {stat.done > 0 && (
                          <div style={{ width: `${donePct}%` }} title={`${stat.done} Done`} className="bg-emerald-500 cursor-pointer hover:brightness-110" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Doughnut & Staff Attendance */}
        <div className="space-y-8">
          
          {/* Company Workload Doughnut */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center pb-2 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="text-indigo-600 dark:text-indigo-400" size={16} /> Company Workload
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Status distribution</p>
              </div>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs font-bold">
                <Loader2 size={20} className="animate-spin text-indigo-500" />
                <span>Loading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <DoughnutChart data={companyWorkloadData} />
                
                {/* Doughnut Legend */}
                <div className="grid grid-cols-2 gap-2 w-full mt-5">
                  {companyWorkloadData.map(item => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-xs ${item.bgClass}`} />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Staff Attendance Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-indigo-600 dark:text-indigo-400" /> Staff Attendance
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Today's attendance summary</p>
              </div>
              <button
                onClick={() => navigate('/staff-attendance')}
                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                View Details <ArrowRight size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Present Count Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">Present</span>
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                    <UserCheck size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-black text-emerald-900 dark:text-emerald-100 font-mono">
                    {loading ? '...' : userStats.online.length}
                  </span>
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Staff Checked In
                  </p>
                </div>
              </div>

              {/* Absent Count Card */}
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider">Absent</span>
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
                    <UserMinus size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-black text-rose-900 dark:text-rose-100 font-mono">
                    {loading ? '...' : userStats.offline.length}
                  </span>
                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                    Not Checked In
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Progress Track */}
            {userStats.total > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Attendance Rate</span>
                  <span className="font-mono text-slate-900 dark:text-white font-black">
                    {Math.round((userStats.online.length / userStats.total) * 100)}% ({userStats.online.length}/{userStats.total})
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-950 rounded-full flex overflow-hidden border border-slate-200/60 dark:border-slate-800">
                  <div
                    style={{ width: `${(userStats.online.length / userStats.total) * 100}%` }}
                    className="bg-emerald-500"
                    title={`Present: ${userStats.online.length}`}
                  />
                  <div
                    style={{ width: `${(userStats.offline.length / userStats.total) * 100}%` }}
                    className="bg-rose-500"
                    title={`Absent: ${userStats.offline.length}`}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Staff Detail Progress Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setSelectedUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-xl border border-indigo-200 dark:border-indigo-500/30">
                    {(selectedUser.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{selectedUser.name}</h2>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedUser.designation || 'Staff Member'} {selectedUser.department ? `• ${selectedUser.department}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto scrollbar-thin space-y-6">
                {(() => {
                  const userTasks = tasks.filter(t => {
                    const assignedId = t.assigned_to?._id || t.assigned_to?.id || (typeof t.assigned_to === 'string' ? t.assigned_to : null);
                    return assignedId === selectedUser._id;
                  });

                  const todayRecord = attendance.find(a => a.user_id.toString() === selectedUser._id.toString());

                  const counts = { pending: 0, current: 0, preview: 0, done: 0 };
                  userTasks.forEach(t => {
                    if (counts[t.status] !== undefined) counts[t.status]++;
                    else counts.pending++;
                  });

                  const total = userTasks.length;
                  const donePct = total > 0 ? Math.round((counts.done / total) * 100) : 0;

                  const doughnutData = [
                    { label: 'Pending', value: counts.pending, color: '#94a3b8' },
                    { label: 'Current', value: counts.current, color: '#3b82f6' },
                    { label: 'Preview', value: counts.preview, color: '#f59e0b' },
                    { label: 'Done', value: counts.done, color: '#10b981' }
                  ];

                  return (
                    <div className="space-y-6">
                      {/* Attendance Card */}
                      {todayRecord ? (
                        <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest block">Checked In</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{formatTime(todayRecord.check_in_time)}</span>
                          </div>
                          <div className="space-y-1 sm:border-x border-slate-200 dark:border-slate-800 sm:px-4 max-sm:border-y max-sm:py-3 px-0">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest block">Checked Out</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                              {todayRecord.check_out_time ? formatTime(todayRecord.check_out_time) : (
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Today
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="space-y-1 sm:pl-2">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest block">Work Hours</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{getWorkHours(todayRecord)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold">
                          <AlertCircle size={14} className="text-amber-500" />
                          <span>Staff member has not checked in today.</span>
                        </div>
                      )}

                      {/* Overall Progress */}
                      <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                        <DoughnutChart data={doughnutData} />
                        
                        <div className="space-y-4 w-full md:w-auto">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                              <p className="text-xs font-bold text-slate-500 uppercase">Completion Rate</p>
                              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">{donePct}%</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                              <p className="text-xs font-bold text-slate-500 uppercase">Total Tasks</p>
                              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">{total}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-2.5 h-2.5 rounded-xs bg-slate-400" /> Pending</span>
                              <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{counts.pending}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-2.5 h-2.5 rounded-xs bg-blue-500" /> Current</span>
                              <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{counts.current}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Preview</span>
                              <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{counts.preview}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Done</span>
                              <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{counts.done}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Task List */}
                      {userTasks.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Assigned Tasks</h3>
                          <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin pr-2">
                            {userTasks.map(task => (
                              <div key={task._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{task.title || 'Untitled Task'}</h4>

                                    {task.dueDate && (
                                      <p className={`text-[10px] font-bold mt-1 ${(new Date(task.dueDate) - new Date()) <= 24 * 60 * 60 * 1000 && task.status !== 'done' ? 'text-rose-500' : 'text-slate-500'}`}>
                                        Due: {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                      </p>
                                    )}

                                    {task.description && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                                    )}
                                  </div>
                                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap border
                                    ${task.status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' :
                                      task.status === 'current' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' :
                                      task.status === 'preview' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' :
                                      'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                                  >
                                    {task.status || 'pending'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
