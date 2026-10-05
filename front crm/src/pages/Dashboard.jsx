import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Target, 
  PhoneCall, 
  Clock, 
  UserCheck, 
  GraduationCap, 
  BookOpen, 
  Layers, 
  Video, 
  Clipboard, 
  CheckCircle2, 
  Wallet, 
  AlertCircle, 
  Award, 
  RefreshCw, 
  ArrowRight, 
  Plus, 
  Calendar,
  Sparkles,
  TrendingUp,
  Activity,
  CheckCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const Dashboard = () => {
  const { user } = useUser() || {};
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalEnquiries: 0,
    activeLeads: 0,
    followupsDue: 0,
    convertedStudents: 0,
    activeStudents: 0,
    activeCourses: 0,
    activeBatches: 0,
    upcomingClasses: 0,
    todayAttendance: 0,
    pendingAssignments: 0,
    feeCollected: 0,
    feeDue: 0,
    certificatesIssued: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem("token");
    const cleanToken = rawToken ? rawToken.replace(/"/g, "") : "";
    return {
      Authorization: cleanToken.startsWith("Bearer ") ? cleanToken : `Bearer ${cleanToken}`,
      "Content-Type": "application/json"
    };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/edtech-dashboard/stats`
        : `${cleanBase}/v1/edtech-dashboard/stats`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      }
    } catch (err) {
      console.error("Fetch EdTech Dashboard stats failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  const kpis = [
    // Admissions
    {
      title: "Total Enquiries",
      value: stats.totalEnquiries,
      icon: Target,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
      desc: "Total registered prospective students",
      link: "/leads"
    },
    {
      title: "Active Leads",
      value: stats.activeLeads,
      icon: PhoneCall,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
      desc: "In-progress counseling pipeline",
      link: "/leads-telecaller"
    },
    {
      title: "Follow-ups Due",
      value: stats.followupsDue,
      icon: Clock,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
      desc: "Scheduled counselor calls pending",
      link: "/leads-telecaller"
    },
    {
      title: "Converted Students",
      value: stats.convertedStudents,
      icon: UserCheck,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
      desc: "Successfully enrolled from leads",
      link: "/academy/enrollments"
    },

    // Academics & Batches
    {
      title: "Active Students",
      value: stats.activeStudents,
      icon: GraduationCap,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
      desc: "Currently enrolled learners",
      link: "/academy/enrollments"
    },
    {
      title: "Active Courses",
      value: stats.activeCourses,
      icon: BookOpen,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
      desc: "Curriculums published",
      link: "/academy/courses"
    },
    {
      title: "Active Batches",
      value: stats.activeBatches,
      icon: Layers,
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900",
      desc: "Live training cohorts in session",
      link: "/academy/batches"
    },
    {
      title: "Upcoming Classes",
      value: stats.upcomingClasses,
      icon: Video,
      color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900",
      desc: "Scheduled Zoom & Google Meet lectures",
      link: "/live-classes"
    },

    // Operations & Grading
    {
      title: "Today's Attendance",
      value: stats.todayAttendance,
      icon: Clipboard,
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900",
      desc: "Present marks recorded today",
      link: "/student-attendance"
    },
    {
      title: "Pending Assignments",
      value: stats.pendingAssignments,
      icon: CheckCircle2,
      color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900",
      desc: "Submissions awaiting grading",
      link: "/assignments"
    },

    // Financial & Certificates
    {
      title: "Fee Collected",
      value: `₹${Number(stats.feeCollected || 0).toLocaleString('en-IN')}`,
      icon: Wallet,
      color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
      desc: "Tuition collected to date",
      link: "/accounts"
    },
    {
      title: "Fee Due",
      value: `₹${Number(stats.feeDue || 0).toLocaleString('en-IN')}`,
      icon: AlertCircle,
      color: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
      desc: "Outstanding tuition balances",
      link: "/accounts"
    },
    {
      title: "Certificates Issued",
      value: stats.certificatesIssued,
      icon: Award,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
      desc: "Course completions certified",
      link: "/certificates"
    }
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans pb-16">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-xs text-indigo-200 border border-white/10">
                <Calendar size={13} /> {todayFormatted}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                Welcome back, {user?.name || 'Administrator'}! 👋
              </h1>
              <p className="text-sm text-indigo-200/90 max-w-xl font-medium">
                EdTech Institute Control Center — Monitor student admissions, batch scheduling, live classrooms, assignments, fees, and course completions in real time.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh Data"}
              </button>
              <Link
                to="/leads"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/30 cursor-pointer"
              >
                <Plus size={14} /> New Enquiry
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "New Lead", path: "/leads", icon: Target, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50" },
            { label: "Create Batch", path: "/academy/batches", icon: Layers, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50" },
            { label: "Attendance", path: "/student-attendance", icon: Clipboard, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50" },
            { label: "Live Class", path: "/live-classes", icon: Video, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/50" },
            { label: "Tuition Fees", path: "/accounts", icon: Wallet, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
            { label: "Certificates", path: "/certificates", icon: Award, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" }
          ].map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.label}
                to={act.path}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-all group"
              >
                <div className={`p-2.5 rounded-xl ${act.color} group-hover:scale-105 transition-transform`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{act.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium">Quick Open</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 13 Core EdTech KPIs Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Core EdTech Operational KPIs
            </h2>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">13 Metrics Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <motion.div
                  key={kpi.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {kpi.title}
                      </p>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {loading ? "..." : kpi.value}
                      </h3>
                    </div>
                    <div className={`p-3 rounded-xl border ${kpi.color}`}>
                      <Icon size={20} />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {kpi.desc}
                    </p>
                    <Link
                      to={kpi.link}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 ml-2"
                    >
                      View <ArrowRight size={12} />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Business Workflow Blueprint Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              EdTech Lifecycle Workflow Pipeline
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
            Standard end-to-end operational pathway from prospective student enquiry to graduation certification.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { step: "01", name: "Enquiry", desc: "Leads captured", icon: Target },
              { step: "02", name: "Counselor", desc: "Follow-up calls", icon: PhoneCall },
              { step: "03", name: "Conversion", desc: "Converted to student", icon: UserCheck },
              { step: "04", name: "Batching", desc: "Assigned to cohort", icon: Layers },
              { step: "05", name: "LMS Learning", desc: "Lessons & live classes", icon: BookOpen },
              { step: "06", name: "Grading & Fees", desc: "Tasks & installments", icon: Wallet },
              { step: "07", name: "Certification", desc: "Verified certificate", icon: Award }
            ].map((st, i) => {
              const SIcon = st.icon;
              return (
                <div 
                  key={st.step} 
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between relative group hover:border-indigo-400 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      {st.step}
                    </span>
                    <SIcon size={16} className="text-slate-400 group-hover:text-indigo-600 transition" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">{st.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Recent Activities & Fast Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Log */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Recent Institute Activity
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Live Feed</span>
            </div>

            {(!stats.recentActivities || stats.recentActivities.length === 0) ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle className="mx-auto opacity-30" size={36} />
                <p className="text-xs font-semibold">No recent activity logged today yet.</p>
                <p className="text-[10px] text-slate-500">Activities like new enquiries, batch creations, and certificate issuances will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentActivities.map((act, i) => (
                  <div
                    key={act.id || i}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{act.message}</p>
                        <p className="text-[10px] text-slate-400">{act.time ? new Date(act.time).toLocaleTimeString() : 'Just now'}</p>
                      </div>
                    </div>
                    {act.link && (
                      <Link to={act.link} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[11px]">
                        Open
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4">
                Academic Shortcuts
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "Course Curriculums", path: "/academy/courses", desc: "Manage syllabi and modules" },
                  { label: "Batch Scheduling", path: "/academy/batches", desc: "Set timings & instructors" },
                  { label: "Student Learning LMS", path: "/academy/learning", desc: "View lessons & video player" },
                  { label: "Assignment Grading", path: "/assignments", desc: "Review student submissions" },
                  { label: "Fee Accounts", path: "/accounts", desc: "Track installments & Razorpay" },
                  { label: "Public Certificate Verify", path: "/certificates", desc: "Download PDF & QR code" }
                ].map(sc => (
                  <Link
                    key={sc.label}
                    to={sc.path}
                    className="block p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border border-slate-200/60 dark:border-slate-700/60 transition group"
                  >
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {sc.label}
                    </p>
                    <p className="text-[10px] text-slate-400">{sc.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-6 p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-center">
              <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                Production-Ready EdTech CRM v1.0
              </p>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400">
                Optimized for Training Institutes & Bootcamps
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;