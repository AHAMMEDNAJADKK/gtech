import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, CheckCircle2, Clock, Eye, Layout, RefreshCw,
  Zap, Target, TrendingUp, BarChart3, FileText,
  AlertCircle, Loader2, Search, ListChecks,
  GitBranch, Terminal, Cpu, Activity, ArrowUpRight,
  Flame, Sparkles, Shield, Star, Calendar, Award,
  ChevronRight, ChevronUp, Users, Database, Layers,
  GitCommit, MonitorDot, Package, Rocket, Braces
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

import { isUserAssigned } from '../utils/taskUtils';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/* ─── Status config ─── */
const STATUS_CONFIG = {
  pending:  { label: 'Pending',     icon: Layout,       color: '#e26a6a', bg: 'bg-[#e26a6a]/10',  text: 'text-[#e26a6a]',  border: 'border-[#e26a6a]/25'  },
  current:  { label: 'In Progress', icon: Clock,        color: '#e5a23a', bg: 'bg-[#e5a23a]/10',  text: 'text-[#e5a23a]',  border: 'border-[#e5a23a]/25'  },
  preview:  { label: 'In Review',   icon: Eye,          color: '#442d82', bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/25' },
  done:     { label: 'Completed',   icon: CheckCircle2, color: '#b7d333', bg: 'bg-[#b7d333]/10',  text: 'text-[#b7d333]',  border: 'border-[#b7d333]/25'  },
};

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

/* SVG Donut */
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

/* SVG Line/Area chart */
const AreaChart = ({ points: rawPoints = [], color = '#442d82', areaColor = '#442d8220', height = 120 }) => {
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
        <linearGradient id="devAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {areaD && <path d={areaD} fill="url(#devAreaGrad)" />}
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="700">{p.label}</text>
        </g>
      ))}
    </svg>
  );
};

/* Horizontal progress bar */
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

/* Status badge */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[(status || '').toLowerCase()] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon size={9} />{cfg.label}
    </span>
  );
};

/* Big metric card */
const BigMetricCard = ({ label, value, icon: Icon, color, subtext, trend, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.45, ease: 'easeOut' }}
    className="relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
  >
    {/* BG glow blob */}
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
    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
    {subtext && <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </motion.div>
);

/* ─── Main Dashboard ─── */
const DeveloperDashboard = () => {
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

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* load user */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('user');
      const id    = (localStorage.getItem('user_id') || '').replace(/"/g, '').trim();
      if (saved) { const p = JSON.parse(saved); p.user_id = id; setUser(p); setCurrentUserId(id); }
    } catch (e) { console.error(e); }
  }, []);

  /* fetch tasks + users */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [tRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/tasks/all`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/v1/users`,  { headers: getAuthHeaders() }),
      ]);
      if (tRes.ok) { const d = await tRes.json(); setTasks(Array.isArray(d) ? d : d?.data || []); }
      if (uRes.ok) { const d = await uRes.json(); setAllUsers(d.data && Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : [])); }
    } catch (err) {
      console.error(err);
      if (silent) showToast('Refresh failed', 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [getAuthHeaders, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── derived data ── */
  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return tasks.filter(t => isUserAssigned(t.assigned_to || t.assignedTo, currentUserId));
  }, [tasks, currentUserId]);

  const statusCounts = useMemo(() => {
    const c = { pending: 0, current: 0, preview: 0, done: 0 };
    myTasks.forEach(t => { const s = (t.status || 'pending').toLowerCase(); if (c[s] !== undefined) c[s]++; });
    return c;
  }, [myTasks]);

  const completionRate = useMemo(() =>
    myTasks.length ? Math.round((statusCounts.done / myTasks.length) * 100) : 0, [myTasks, statusCounts]);

  /* weekly activity – last 7 days */
  const weeklyActivity = useMemo(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
    myTasks.forEach(t => {
      const d = new Date(t.createdAt || t.created_at);
      if (d >= start) counts[d.getDay()]++;
    });
    /* Rotate array so today is last */
    const today = now.getDay();
    const rotated = [];
    for (let i = 0; i < 7; i++) {
      const idx = (today - 6 + i + 7) % 7;
      rotated.push({ label: DAYS[idx].slice(0,2), value: counts[idx] });
    }
    return rotated;
  }, [myTasks]);

  /* team developer task load */
  const devUserTasks = useMemo(() => {
    if (!user || !user.departmentId) return [];
    const myDeptId = typeof user.departmentId === 'object' ? (user.departmentId._id || user.departmentId.id) : user.departmentId;
    const validUserIds = new Set();
    allUsers.forEach(u => {
      if (!u || !u.departmentId) return;
      const uDept = typeof u.departmentId === 'object' ? (u.departmentId._id || u.departmentId.id) : u.departmentId;
      if (String(uDept) === String(myDeptId)) {
        validUserIds.add(String(u._id || u.id));
      }
    });

    const map = {};
    tasks.forEach(t => {
      const aObj = t.assigned_to && typeof t.assigned_to === 'object' ? t.assigned_to : null;
      const aId  = String(aObj ? (aObj.id || aObj._id) : t.assigned_to);
      if (!validUserIds.has(aId)) return;

      const name = aObj?.name || (() => {
        const f = allUsers.find(u => String(u._id || u.id) === aId);
        return f?.name || `Dev #${aId.slice(0,5)}`;
      })();
      if (!map[aId]) map[aId] = { name, aId, total: 0, done: 0, current: 0, pending: 0, preview: 0 };
      map[aId].total++;
      const s = (t.status || '').toLowerCase();
      if (map[aId][s] !== undefined) map[aId][s]++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tasks, allUsers, user]);

  /* recent 5 completed tasks */
  const recentlyCompleted = useMemo(() =>
    [...myTasks].filter(t => (t.status || '').toLowerCase() === 'done')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5), [myTasks]);

  /* filtered task list */
  const filteredTasks = useMemo(() => myTasks.filter(t => {
    const matchStatus = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [myTasks, statusFilter, searchQuery]);

  /* helpers */
  const fmtTime = d => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = d => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = str => { if (!str) return '—'; return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const fmtFull  = str => { if (!str) return '—'; return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };

  const donutSegments = [
    { value: statusCounts.pending, color: '#e26a6a' },
    { value: statusCounts.current, color: '#e5a23a' },
    { value: statusCounts.preview, color: '#442d82' },
    { value: statusCounts.done,    color: '#b7d333' },
  ];

  /* ────── Loading screen ────── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <Code2 size={40} className="text-indigo-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-lime-400 border-2 border-white dark:border-slate-950 animate-bounce" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="text-indigo-400 animate-spin" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading Developer Dashboard</p>
        </div>
      </motion.div>
    </div>
  );

  /* ════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div >

      {/* ══ TOP HERO HEADER ══ */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">

        {/* Left: Title block */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="p-4 rounded-3xl bg-white-500/10 border border-indigo-500/20 shadow-sm shadow-indigo-500/10">
              <Code2 size={30} className="text-indigo-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-lime-400 border-2 border-white dark:border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                Developer Command Centre
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 leading-tight">
              {user?.name ? `${user.name.split(' ')[0]}'s Dashboard` : 'Developer Dashboard'}
            </h1>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              {fmtDate(currentTime)}
            </p>
          </div>
        </div>

        {/* Right: Actions + clock */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live clock */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/60 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-xs font-black text-slate-600 dark:text-slate-300 font-mono tracking-tight">
              {fmtTime(currentTime)}
            </span>
          </div>

          {/* Refresh */}
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/60 hover:border-indigo-400/50 text-slate-500 dark:text-slate-400 hover:text-indigo-500 text-xs font-bold transition-all shadow-sm">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {/* Todo */}
          <button onClick={() => navigate('/todo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/60 hover:border-indigo-400/50 text-slate-500 dark:text-slate-400 hover:text-indigo-500 text-xs font-bold transition-all shadow-sm">
            <ListChecks size={13} />
            Task Board
          </button>

          {/* Report */}
          <button onClick={() => {
            const desigName = String(user?.designation || user?.designationId?.name || '').toLowerCase().trim();
            const roleName = String(user?.role || user?.role_id || '').toLowerCase().trim();
            const isHod = desigName.includes('hod') || roleName.includes('hod');
            const isHodRd = isHod && (desigName.includes('r&d') || desigName.includes('research'));
            navigate(isHodRd ? '/hod-rd-report' : '/developer-report');
          }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black transition-all shadow-md shadow-indigo-500/25">
            <FileText size={13} />
            Daily Report
            <ArrowUpRight size={12} />
          </button>
        </div>
      </motion.div>

      {/* ══ ROW 1: 5 BIG METRIC CARDS ══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <BigMetricCard label="Total Assigned"   value={myTasks.length}       icon={ListChecks}   color="#442d82" subtext="Lifetime tasks"          delay={0}    />
        <BigMetricCard label="In Progress"      value={statusCounts.current} icon={Zap}          color="#e5a23a" subtext="Active right now"        delay={0.06} />
        <BigMetricCard label="In Review"        value={statusCounts.preview} icon={Eye}          color="#442d82" subtext="Awaiting feedback"       delay={0.12} />
        <BigMetricCard label="Pending"          value={statusCounts.pending} icon={AlertCircle}  color="#e26a6a" subtext="Not started yet"         delay={0.18} />
        <BigMetricCard label="Completed"        value={statusCounts.done}    icon={CheckCircle2} color="#b7d333" subtext={`${completionRate}% rate`} delay={0.24} />
      </div>

      {/* ══ ROW 2: Donut + Activity Chart + Progress Card ══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">

        {/* ── Donut Distribution ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Task Distribution</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Status breakdown overview</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-indigo-500/10"><BarChart3 size={16} className="text-indigo-500" /></div>
          </div>

          <div className="flex items-center gap-8">
            {/* Donut */}
            <div className="relative shrink-0">
              <DonutChart segments={donutSegments} size={130} strokeWidth={16} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{completionRate}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Done</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-3">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = statusCounts[key] || 0;
                const pct   = myTasks.length ? Math.round((count / myTasks.length) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{count}</span>
                        <span className="text-[9px] font-bold text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <ProgressBar pct={pct} color={cfg.color} height={4} />
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ── Weekly Activity Area Chart ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-7 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Weekly Activity</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Tasks assigned last 7 days</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Live</span>
            </div>
          </div>

          <AreaChart points={weeklyActivity} color="#442d82" height={120} />

          {/* Summary row */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">This Week Total</p>
              <p className="text-xl font-black text-indigo-500 leading-none mt-0.5">
                {weeklyActivity.reduce((s, d) => s + d.value, 0)} <span className="text-xs text-slate-400 font-semibold">tasks</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Peak Day</p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200 text-right leading-none mt-0.5">
                {weeklyActivity.reduce((best, d) => d.value > best.value ? d : best, { label: '—', value: 0 }).label}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Performance card ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-7 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Performance</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Individual metrics</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#b7d333]/10"><Award size={16} className="text-[#b7d333]" /></div>
          </div>

          {/* Big completion % */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 mb-4">
            <div className="relative mb-3">
              <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="44" fill="none" stroke="#e2e8f0" strokeWidth="10" className="dark:stroke-slate-800" />
                <motion.circle cx="55" cy="55" r="44" fill="none" stroke="#b7d333" strokeWidth="10"
                  strokeDasharray={`${2*Math.PI*44}`}
                  initial={{ strokeDashoffset: 2*Math.PI*44 }}
                  animate={{ strokeDashoffset: 2*Math.PI*44 * (1 - completionRate/100) }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                  strokeLinecap="round" transform="rotate(-90 55 55)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{completionRate}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Complete</span>
              </div>
            </div>
          </div>

          {/* Quick KPI bars */}
          {[
            { label: 'Completed',   val: statusCounts.done,    max: myTasks.length || 1, color: '#b7d333' },
            { label: 'In Progress', val: statusCounts.current, max: myTasks.length || 1, color: '#e5a23a' },
            { label: 'Pending',     val: statusCounts.pending, max: myTasks.length || 1, color: '#e26a6a' },
          ].map((kpi, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{kpi.label}</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">{kpi.val} / {myTasks.length}</span>
              </div>
              <ProgressBar pct={myTasks.length ? (kpi.val / myTasks.length) * 100 : 0} color={kpi.color} height={5} />
            </div>
          ))}
        </motion.div>
      </div>

      {/* ══ ROW 3: Team Load + Recently Completed ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">

        {/* ── Team Task Load (spans 2 cols) ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Team Task Load</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Tasks distributed across all members</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <Users size={13} className="text-indigo-400" />
              <span>{devUserTasks.length} members</span>
            </div>
          </div>

          {devUserTasks.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <Users size={28} className="text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-400">No team data found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {devUserTasks.map((dev, i) => {
                const pct  = dev.total ? Math.round((dev.done / dev.total) * 100) : 0;
                const isMe = String(dev.aId) === String(currentUserId);
                const barColor = pct >= 75 ? '#b7d333' : pct >= 40 ? '#e5a23a' : '#e26a6a';
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      isMe ? 'border-indigo-400/30 bg-indigo-500/5' : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-950/40'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isMe ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      {(dev.name || 'U').charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[12px] font-black truncate ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {dev.name} {isMe && <span className="text-[9px] font-bold text-indigo-400 ml-1">(You)</span>}
                        </span>
                        <span className="text-[11px] font-black ml-2 shrink-0" style={{ color: barColor }}>{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} color={barColor} height={6} />
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-[9px] font-bold text-slate-400">Total: <b className="text-slate-600 dark:text-slate-300">{dev.total}</b></span>
                        <span className="text-[9px] font-bold text-[#b7d333]">✓ {dev.done} done</span>
                        <span className="text-[9px] font-bold text-[#e5a23a]">⚡ {dev.current} active</span>
                        <span className="text-[9px] font-bold text-[#e26a6a]">⏳ {dev.pending} pending</span>
                        {dev.preview > 0 && <span className="text-[9px] font-bold text-indigo-400">🔍 {dev.preview} review</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Recently Completed ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Recently Done</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Latest completed tasks</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#b7d333]/10">
              <Rocket size={14} className="text-[#b7d333]" />
            </div>
          </div>

          {recentlyCompleted.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800">
                <CheckCircle2 size={24} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No completed tasks yet</p>
              <p className="text-[10px] font-semibold text-slate-400">Finish tasks to see them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentlyCompleted.map((t, i) => (
                <motion.div key={t.id || i}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#b7d333]/5 border border-[#b7d333]/15 hover:bg-[#b7d333]/10 transition-colors">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-[#b7d333]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={11} className="text-[#b7d333]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">{t.title}</p>
                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">{fmtShort(t.updatedAt || t.createdAt)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ══ ROW 4: Quick Stats ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { icon: Braces,     label: 'Total Team Tasks', value: devUserTasks.reduce((sum, u) => sum + u.total, 0),                               color: '#442d82' },
          { icon: Users,      label: 'Team Members',     value: devUserTasks.length,                        color: '#e5a23a' },
          { icon: GitCommit,  label: 'My Completion',    value: `${completionRate}%`,                       color: '#b7d333' },
          { icon: Flame,      label: 'Active Tasks',     value: statusCounts.current + statusCounts.preview, color: '#e26a6a' },
        ].map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + i * 0.05 }}
            className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none">{s.value}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ══ ROW 5: My Tasks Full Table ══ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
        className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl shadow-sm overflow-hidden">

        {/* Table header controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">My Assigned Tasks</h2>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              Showing {filteredTasks.length} of {myTasks.length} tasks
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="pl-9 pr-4 py-2.5 text-[11px] font-semibold rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400/50 w-44" />
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all',     label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'current', label: 'WIP' },
                { key: 'preview', label: 'Review' },
                { key: 'done',    label: 'Done' },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                    statusFilter === f.key
                      ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table body */}
        {filteredTasks.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 text-center">
            <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-800">
              <Terminal size={28} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-black text-slate-500 dark:text-slate-400">
              {myTasks.length === 0 ? 'No tasks assigned yet' : 'No tasks match your filter'}
            </p>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 max-w-xs">
              {myTasks.length === 0 ? 'Tasks assigned to you by your manager will appear here.' : 'Try adjusting your search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  {['#', 'Task Title', 'Description', 'Status', 'Assigned By', 'Date', 'File'].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap
                      last:hidden last:lg:table-cell [&:nth-child(3)]:hidden [&:nth-child(3)]:md:table-cell
                      [&:nth-child(5)]:hidden [&:nth-child(5)]:md:table-cell
                      [&:nth-child(6)]:hidden [&:nth-child(6)]:lg:table-cell
                    ">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTasks.map((task, i) => {
                    const creator = task.created_by && typeof task.created_by === 'object'
                      ? (task.created_by.name || task.created_by.email || 'Admin')
                      : 'Admin';
                    const isExpanded = expandedTask === (task.id || task._id || i);
                    return (
                      <React.Fragment key={task.id || task._id || i}>
                        <motion.tr
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.015 }}
                          onClick={() => setExpandedTask(isExpanded ? null : (task.id || task._id || i))}
                          className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-indigo-500/[0.02] dark:hover:bg-indigo-500/[0.04] transition-colors cursor-pointer group"
                        >
                          {/* # */}
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black text-slate-300 dark:text-slate-700">{String(i+1).padStart(2,'0')}</span>
                          </td>

                          {/* Title */}
                          <td className="px-6 py-4 max-w-[200px]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-7 rounded-full shrink-0"
                                style={{ backgroundColor: STATUS_CONFIG[(task.status||'pending').toLowerCase()]?.color || '#442d82' }} />
                              <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</p>
                            </div>
                          </td>

                          {/* Description */}
                          <td className="px-6 py-4 max-w-[200px] hidden md:table-cell">
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                              {task.description || <span className="text-slate-300 dark:text-slate-700 italic">No description</span>}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <StatusBadge status={task.status} />
                          </td>

                          {/* Assigned by */}
                          <td className="px-6 py-4 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">{creator.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[90px]">{creator}</span>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{fmtFull(task.createdAt || task.created_at)}</span>
                          </td>

                          {/* File */}
                          <td className="px-6 py-4 hidden lg:table-cell">
                            {(task.file_url || task.file) ? (
                              <a href={task.file_url || task.file} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors">
                                <FileText size={12} /> View file
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>
                        </motion.tr>

                        {/* Expanded row */}
                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="px-0 py-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-8 py-5 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.06] border-b border-indigo-500/10 flex flex-wrap gap-6">
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Full Title</p>
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{task.title}</p>
                                    </div>
                                    {task.description && (
                                      <div className="flex-1 min-w-[200px]">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Description</p>
                                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{task.description}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                                      <StatusBadge status={task.status} />
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Created</p>
                                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{fmtFull(task.createdAt || task.created_at)}</p>
                                    </div>
                                    {(task.file_url || task.file) && (
                                      <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Attachment</p>
                                        <a href={task.file_url || task.file} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors">
                                          <FileText size={13} /> Open File
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        <div className="px-7 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(statusCounts).map(([key, count]) => {
              const cfg = STATUS_CONFIG[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{cfg.label}</span>
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[9px] font-bold text-slate-400">
            <Terminal size={11} className="text-indigo-400" />
            <span>{myTasks.length} total tasks · {completionRate}% completion rate</span>
            <span className="text-slate-300 dark:text-slate-700">· click any row to expand</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DeveloperDashboard;
