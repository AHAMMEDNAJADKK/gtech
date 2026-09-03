import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckCircle2, Clock, Eye, RefreshCw,
  Zap, Target, TrendingUp, BarChart3, FileText,
  AlertCircle, Loader2, Search, ListChecks,
  Activity, ArrowUpRight, Award, ChevronUp, Users,
  Calendar, Shield, Sparkles, Terminal, Mail, Phone, LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/* ─── Status config ─── */
const STATUS_CONFIG = {
  pending:  { label: 'Pending',     icon: LayoutDashboard, color: '#e26a6a', bg: 'bg-[#e26a6a]/10',  text: 'text-[#e26a6a]',  border: 'border-[#e26a6a]/25'  },
  current:  { label: 'In Progress', icon: Clock,        color: '#e5a23a', bg: 'bg-[#e5a23a]/10',  text: 'text-[#e5a23a]',  border: 'border-[#e5a23a]/25'  },
  preview:  { label: 'In Review',   icon: Eye,          color: '#442d82', bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/25' },
  done:     { label: 'Completed',   icon: CheckCircle2, color: '#b7d333', bg: 'bg-[#b7d333]/10',  text: 'text-[#b7d333]',  border: 'border-[#b7d333]/25'  },
};

/* ─── Sub-components ─── */
const DonutChart = ({ segments, size = 130, strokeWidth = 14 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      {total === 0
        ? <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} className="dark:stroke-slate-800" />
        : segments.map((seg, i) => {
            const dash = (seg.value / total) * circ;
            const gap  = circ - dash;
            const el = (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                stroke={seg.color} strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
                strokeLinecap="butt" className="transition-all duration-700" />
            );
            offset += dash;
            return el;
          })
      }
    </svg>
  );
};

const AreaChart = ({ points: rawPoints = [], color = '#442d82', height = 120 }) => {
  const max = Math.max(...rawPoints.map(p => p.value), 1);
  const W = 500, H = height, PL = 8, PR = 8, PT = 10, PB = 20;
  const cW = W - PL - PR, cH = H - PT - PB;
  const pts = rawPoints.map((p, i) => ({
    x: PL + (rawPoints.length < 2 ? 0 : (i / (rawPoints.length - 1)) * cW),
    y: PT + cH - (p.value / max) * cH,
    label: p.label,
    value: p.value,
  }));
  const pathD = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
  const areaD = pts.length ? `${pathD} L ${pts[pts.length-1].x} ${PT+cH} L ${pts[0].x} ${PT+cH} Z` : '';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="commonAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {areaD && <path d={areaD} fill="url(#commonAreaGrad)" />}
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#fff" strokeWidth="2" className="dark:stroke-slate-900" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="700">{p.label}</text>
        </g>
      ))}
    </svg>
  );
};

const ProgressBar = ({ pct = 0, color = '#b7d333', height = 6, animated = true }) => (
  <div className={`w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden`} style={{ height }}>
    <motion.div
      className="h-full rounded-full"
      style={{ backgroundColor: color }}
      initial={animated ? { width: 0 } : { width: `${pct}%` }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[(status || '').toLowerCase()] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon size={9} />{cfg.label}
    </span>
  );
};

const BigMetricCard = ({ label, value, icon: Icon, color, subtext, trend, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.45, ease: 'easeOut' }}
    className="relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
  >
    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500"
      style={{ backgroundColor: color }} />
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 rounded-2xl" style={{ backgroundColor: `${color}15` }}>
        <Icon size={22} style={{ color }} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${trend >= 0 ? 'bg-[#b7d333]/10 text-[#b7d333]' : 'bg-[#e26a6a]/10 text-[#e26a6a]'}`}>
          <ChevronUp size={9} className={trend >= 0 ? '' : 'rotate-180'} />
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-3xl font-black text-slate-800 dark:text-slate-100 leading-none mb-1">{value}</p>
    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
    {subtext && <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </motion.div>
);

/* ─── Main Dashboard ─── */
const CommonDashboard = () => {
  const [user, setUser]               = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [tasks, setTasks]             = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedTask, setExpandedTask] = useState(null);
  
  const { showToast } = useToast();
  const navigate      = useNavigate();

  const getAuthHeaders = useCallback(() => {
    const raw = localStorage.getItem('token');
    const tk  = raw ? raw.replace(/"/g, '') : '';
    return { Authorization: tk.startsWith('Bearer ') ? tk : `Bearer ${tk}`, 'Content-Type': 'application/json' };
  }, []);

  /* Live clock */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Load user from local storage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('user');
      const id    = (localStorage.getItem('user_id') || '').replace(/"/g, '').trim();
      if (saved) {
        const p = JSON.parse(saved);
        p.user_id = id;
        setUser(p);
        setCurrentUserId(id);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  /* Fetch tasks and users */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [tRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/tasks/all`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/v1/users`,  { headers: getAuthHeaders() }),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setTasks(Array.isArray(d) ? d : d?.data || []);
      }
      if (uRes.ok) {
        const d = await uRes.json();
        setAllUsers(d.data && Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []));
      }
    } catch (err) {
      console.error(err);
      if (silent) showToast('Refresh failed', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived Data ── */
  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return tasks.filter(t => {
      const aId = t.assigned_to && typeof t.assigned_to === 'object' ? (t.assigned_to.id || t.assigned_to._id) : t.assigned_to;
      return String(aId).trim() === String(currentUserId).trim();
    });
  }, [tasks, currentUserId]);

  const statusCounts = useMemo(() => {
    const c = { pending: 0, current: 0, preview: 0, done: 0 };
    myTasks.forEach(t => {
      const s = (t.status || 'pending').toLowerCase();
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [myTasks]);

  const completionRate = useMemo(() =>
    myTasks.length ? Math.round((statusCounts.done / myTasks.length) * 100) : 0, [myTasks, statusCounts]);

  /* Weekly Activity (last 7 days) */
  const weeklyActivity = useMemo(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0,0,0,0);
    myTasks.forEach(t => {
      const d = new Date(t.createdAt || t.created_at);
      if (d >= start) counts[d.getDay()]++;
    });
    const today = now.getDay();
    const rotated = [];
    for (let i = 0; i < 7; i++) {
      const idx = (today - 6 + i + 7) % 7;
      rotated.push({ label: DAYS[idx].slice(0,2), value: counts[idx] });
    }
    return rotated;
  }, [myTasks]);

  /* Team members from the same department and their task load */
  const teamMembers = useMemo(() => {
    if (!user) return [];
    const myDeptId = user.departmentId?._id || user.departmentId?.id || user.departmentId;
    if (!myDeptId) return [];

    // Filter users in the same department (excluding current user)
    const matchingUsers = allUsers.filter(u => {
      const uDeptId = u.departmentId?._id || u.departmentId?.id || u.departmentId;
      return uDeptId && String(uDeptId) === String(myDeptId);
    });

    return matchingUsers.map(u => {
      const uid = u._id || u.id;
      // Calculate tasks for this user
      const userTasks = tasks.filter(t => {
        const aId = t.assigned_to && typeof t.assigned_to === 'object' ? (t.assigned_to.id || t.assigned_to._id) : t.assigned_to;
        return String(aId).trim() === String(uid).trim();
      });
      const pending = userTasks.filter(t => (t.status || 'pending').toLowerCase() !== 'done').length;
      const completed = userTasks.filter(t => (t.status || '').toLowerCase() === 'done').length;

      return {
        ...u,
        taskStats: {
          total: userTasks.length,
          pending,
          completed
        }
      };
    });
  }, [allUsers, tasks, user]);

  /* Recent 5 completed tasks */
  const recentlyCompleted = useMemo(() =>
    [...myTasks].filter(t => (t.status || '').toLowerCase() === 'done')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5), [myTasks]);

  /* Filtered personal tasks list */
  const filteredTasks = useMemo(() => myTasks.filter(t => {
    const matchStatus = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [myTasks, statusFilter, searchQuery]);

  /* Update personal task status directly */
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/task-status/${taskId}?status=${newStatus}`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('Task status updated successfully', 'success');
        fetchData(true); // silent refresh
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating task status', 'error');
    }
  };

  /* Helpers */
  const fmtTime = d => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = d => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = str => { if (!str) return '—'; return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const fmtLogin = str => {
    if (!str) return 'Never logged in';
    return new Date(str).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const donutSegments = [
    { value: statusCounts.pending, color: '#e26a6a' },
    { value: statusCounts.current, color: '#e5a23a' },
    { value: statusCounts.preview, color: '#442d82' },
    { value: statusCounts.done,    color: '#b7d333' },
  ];

  /* Loading State */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <LayoutDashboard size={40} className="text-indigo-500 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="text-indigo-400 animate-spin" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading Dashboard...</p>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">

      {/* ══ TOP HERO HEADER ══ */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left Profile Block */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-2xl shadow-sm">
              {user?.name ? user.name.slice(0,2).toUpperCase() : 'U'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-lime-400 border-2 border-white dark:border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-black text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 rounded-full uppercase tracking-widest">
                {user?.departmentId?.name || user?.department || 'General Department'}
              </span>
              <span className="text-[11px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                {user?.designationId?.name || user?.designation || 'Staff'}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 leading-tight">
              Welcome back, {user?.name || 'Employee'}!
            </h1>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1.5">
              Last Login: {fmtLogin(user?.lastLogin || user?.updatedAt)}
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live clock */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/60 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-sm font-black text-slate-600 dark:text-slate-300 font-mono tracking-tight">
              {fmtTime(currentTime)}
            </span>
          </div>

          {/* Refresh */}
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/60 hover:border-indigo-400/50 text-slate-500 dark:text-slate-400 hover:text-indigo-500 text-sm font-bold transition-all shadow-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {/* Report Link */}
          <button onClick={() => navigate(getReportRoute())}
            className="flex items-center gap-2 px-5.5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black transition-all shadow-md shadow-indigo-500/25">
            <FileText size={14} />
            Daily Report
            <ArrowUpRight size={13} />
          </button>
        </div>
      </motion.div>

      {/* ══ ROW 1: METRIC CARDS ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigMetricCard label="Total Assigned"   value={myTasks.length}       icon={ListChecks}   color="#442d82" subtext="All tasks assigned"   delay={0}    />
        <BigMetricCard label="In Progress"      value={statusCounts.current} icon={Zap}          color="#e5a23a" subtext="Working on currently" delay={0.05} />
        <BigMetricCard label="In Review"        value={statusCounts.preview} icon={Eye}          color="#442d82" subtext="Submitted for review" delay={0.1}  />
        <BigMetricCard label="Completed"        value={statusCounts.done}    icon={CheckCircle2} color="#b7d333" subtext={`${completionRate}% complete`} delay={0.15} />
      </div>

      {/* ══ ROW 2: CHARTS & STATS ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Task Distribution Donut */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Distribution</h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Task status breakdown</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-indigo-500/10"><BarChart3 size={16} className="text-indigo-500" /></div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <DonutChart segments={donutSegments} size={110} strokeWidth={14} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none">{completionRate}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Done</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = statusCounts[key] || 0;
                const pct   = myTasks.length ? Math.round((count / myTasks.length) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span className="font-bold text-slate-500 dark:text-slate-400">{cfg.label}</span>
                      </div>
                      <span className="font-black text-slate-700 dark:text-slate-200">{count}</span>
                    </div>
                    <ProgressBar pct={pct} color={cfg.color} height={3.5} />
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Weekly Activity Line/Area Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Weekly Activity</h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Task load trends</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase">
              <Activity size={11} /> Live Trend
            </div>
          </div>

          <AreaChart points={weeklyActivity} color="#442d82" height={100} />

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Weekly Additions</p>
              <p className="text-lg font-black text-indigo-500 leading-none mt-0.5">
                {weeklyActivity.reduce((s, d) => s + d.value, 0)} <span className="text-xs text-slate-400 font-bold">tasks</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Busy Day</p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200 text-right leading-none mt-0.5">
                {weeklyActivity.reduce((best, d) => d.value > best.value ? d : best, { label: '—', value: 0 }).label}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Personal Details & Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Contact & Profile</h2>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Corporate identity details</p>
          </div>
          
          <div className="space-y-3.5">
            <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
              <Mail size={16} className="text-indigo-400" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Email Address</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{user?.email || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
              <Phone size={16} className="text-indigo-400" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{user?.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
              <Calendar size={16} className="text-indigo-400" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Employee ID</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{user?.employeeId || 'N/A'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══ ROW 3: PERSONAL TASK LIST ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Task Search & List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                <ListChecks size={20} className="text-indigo-500" />
                My Tasks ({filteredTasks.length})
              </h2>
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Manage tasks assigned directly to you</p>
            </div>

            {/* Filter tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'pending', 'current', 'preview', 'done'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    statusFilter === status
                      ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title, content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 focus:border-indigo-500 dark:focus:border-indigo-500 focus:outline-none text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 transition-all shadow-sm"
            />
          </div>

          {/* Tasks Container */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredTasks.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-10 text-center flex flex-col items-center justify-center">
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30 mb-3 text-slate-400">
                    <Target size={24} />
                  </div>
                  <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No tasks found</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">Try changing status filter or search query</p>
                </motion.div>
              ) : (
                filteredTasks.map(t => {
                  const isDone = (t.status || '').toLowerCase() === 'done';
                  const isExpanded = expandedTask === t._id;
                  return (
                    <motion.div
                      key={t._id}
                      layoutId={t._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group bg-white dark:bg-slate-900 border ${
                        isExpanded ? 'border-indigo-400/50 shadow-md' : 'border-slate-200/60 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700'
                      } rounded-3xl p-5 transition-all duration-300 relative`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0" onClick={() => setExpandedTask(isExpanded ? null : t._id)}>
                          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <StatusBadge status={t.status} />
                            {t.dueDate && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                <Calendar size={10} /> Due {fmtShort(t.dueDate)}
                              </span>
                            )}
                          </div>
                          <h3 className={`text-base font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 transition-colors cursor-pointer ${isDone ? 'line-through opacity-60' : ''}`}>
                            {t.title}
                          </h3>
                        </div>

                        {/* Status Toggle Box */}
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                          {['pending', 'current', 'preview', 'done'].map(status => {
                            const cfg = STATUS_CONFIG[status];
                            const isActive = (t.status || 'pending').toLowerCase() === status;
                            return (
                              <button
                                key={status}
                                title={`Mark as ${cfg.label}`}
                                onClick={() => handleUpdateStatus(t._id, status)}
                                className={`w-6 h-6 rounded-xl flex items-center justify-center transition-all ${
                                  isActive
                                    ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200/30'
                                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-800'
                                }`}
                                style={{ color: isActive ? cfg.color : '#94a3b8' }}
                              >
                                <cfg.icon size={11} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Expanded description details */}
                      {isExpanded && t.description && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                          {t.description}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Team Members list */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              Team Members ({teamMembers.length})
            </h2>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Colleagues in your department</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-5 shadow-sm space-y-4 max-h-[500px] overflow-y-auto">
            {teamMembers.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center">
                <Users size={24} className="text-slate-300 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No team members</p>
                <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">You are alone in this department</p>
              </div>
            ) : (
              teamMembers.map(member => (
                <div key={member._id || member.id} className="flex items-center gap-3.5 pb-4 last:pb-0 border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-xs shrink-0">
                    {member.name ? member.name.slice(0,2).toUpperCase() : 'M'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate leading-snug">
                      {member.name}
                    </p>
                    <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
                      {member.designationId?.name || member.designation || 'Staff'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <LogIn size={10} /> Login: {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                    </p>
                  </div>
                  
                  {/* Task load status */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {member.taskStats?.completed}/{member.taskStats?.total}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tasks</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Completed Activities */}
          <div className="space-y-4 pt-2">
            <div>
              <h2 className="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Recently Completed</h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Your achievements</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-5 shadow-sm space-y-3.5">
              {recentlyCompleted.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No completed tasks yet</p>
                </div>
              ) : (
                recentlyCompleted.map(t => (
                  <div key={t._id} className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="text-[#b7d333] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1 leading-snug">
                        {t.title}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        Completed: {new Date(t.updatedAt || t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default CommonDashboard;
