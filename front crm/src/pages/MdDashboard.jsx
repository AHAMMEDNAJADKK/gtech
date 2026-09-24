import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ToastProvider';
import HrDashboard from './HrDashboard';
import Attendance from './Attendance';
import AccountantDashboard from './AccountantDashboard';
import EnrollmentTracking from './EnrollmentTracking';
import MarketingDashboard from './Marketing Dashboard';
import CounselorDashboard from './CounselorDashboard';
import DeveloperDashboard from './DeveloperDashboard';
import GraphicDesignerDashboard from './GraphicDesignerDashboard';
import VideographerDashboard from './VideographerDashboard';
import { 
  Users, Megaphone, GraduationCap, Code2, Palette, Video, 
  Calculator, ShieldCheck, BookOpen, Building2, Target, RefreshCw,
  FolderKanban, ListTodo, Wallet, TrendingDown, TrendingUp, ShoppingBag, PieChart, BarChart3, Clock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const DEPARTMENT_TABS = [
  { id: 'overview', label: 'Executive Overview', icon: ShieldCheck, color: 'text-indigo-600' },
  { id: 'hr', label: 'HR View', icon: Users, color: 'text-rose-600' },
  { id: 'attendance', label: 'Attendance Logs', icon: Clock, color: 'text-rose-600' },
  { id: 'accountant', label: 'Finance & Accounts', icon: Calculator, color: 'text-emerald-600' },
  { id: 'academy', label: 'Academy & LMS', icon: BookOpen, color: 'text-indigo-600' },
  { id: 'marketing', label: 'Digital Marketing', icon: Megaphone, color: 'text-purple-600' },
  { id: 'counselor', label: 'Academic Counselor', icon: GraduationCap, color: 'text-blue-600' },
  { id: 'developer', label: 'Development & Tech', icon: Code2, color: 'text-cyan-600' },
  { id: 'graphic', label: 'Graphic Design', icon: Palette, color: 'text-pink-600' },
  { id: 'video', label: 'Video Production', icon: Video, color: 'text-indigo-600' },
];

/**
 * Enterprise Distribution Pie / Donut Chart
 */
const ExecutivePieChart = ({ data }) => {
  const slices = [
    { label: 'Corporate Clients', value: data?.activeClientsCount || 0, color: '#6366f1' },
    { label: 'Active Projects', value: data?.activeProjectsCount || 0, color: '#a855f7' },
    { label: 'Workforce Staff', value: data?.activeEmployeesCount || 0, color: '#f43f5e' },
    { label: 'Academy Students', value: data?.activeStudentsCount || 0, color: '#3b82f6' },
    { label: 'Completed Tasks', value: data?.completedTasksCount || 0, color: '#10b981' }
  ];

  const total = slices.reduce((acc, s) => acc + s.value, 0);
  let accumulated = 0;

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Enterprise Operations Distribution
          </h3>
        </div>
        <span className="text-[11px] font-extrabold text-slate-500">
          Total: {total} Metrics
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
            {slices.map((slice, i) => {
              const percent = total > 0 ? slice.value / total : 0;
              const strokeDasharray = `${percent * 314.159} ${314.159 - (percent * 314.159)}`;
              const strokeDashoffset = -((accumulated / (total || 1)) * 314.159);
              accumulated += slice.value;
              return (
                <circle
                  key={i}
                  cx="60"
                  cy="60"
                  r="50"
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 hover:stroke-[16px] cursor-pointer"
                  title={`${slice.label}: ${slice.value}`}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
            <span className="text-xl font-black text-slate-800 dark:text-white">{total}</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2">
          {slices.map((slice, i) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <div key={i} className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="truncate text-[11px]">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-slate-100 font-extrabold">{slice.value}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Financial Ledger & Operating Budget Bar Graph
 */
const ExecutiveBarGraph = ({ data }) => {
  const bars = [
    { label: 'Account', value: data?.accountBalance || 0, color: 'from-emerald-500 to-teal-600' },
    { label: 'Income', value: data?.totalIncome || 0, color: 'from-indigo-500 to-blue-600' },
    { label: 'Expenses', value: data?.totalExpenses || 0, color: 'from-rose-500 to-pink-600' },
    { label: 'Purchases', value: data?.totalPurchases || 0, color: 'from-amber-500 to-orange-600' }
  ];

  const maxVal = Math.max(...bars.map(b => b.value), 1000);

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Financial Ledger & Operating Budget (₹)
          </h3>
        </div>
        <span className="text-[11px] font-extrabold text-slate-500">
          Executive Accounts
        </span>
      </div>

      <div className="flex items-end justify-around gap-4 h-44 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
        {bars.map((bar, i) => {
          const heightPct = Math.max(10, Math.round((bar.value / maxVal) * 100));
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 opacity-80 group-hover:scale-110 transition-transform">
                ₹{bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value}
              </span>
              <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-xl overflow-hidden h-full flex items-end">
                <div 
                  className={`w-full bg-gradient-to-t ${bar.color} rounded-t-xl transition-all duration-500 group-hover:brightness-110`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[70px]">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Overall Executive Stat Cards & Visual Charts Component
 */
const OverallStatCards = ({ data }) => {
  const hr = data?.hr || {};

  return (
    <div className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md flex flex-col gap-6">
      {/* 9 EXECUTIVE METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* 1. Clients */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Corporate Clients</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data?.activeClientsCount ?? '--'}</span>
          <span className="text-xs font-medium text-slate-400">Active corporate client profiles</span>
        </div>

        {/* 2. Projects */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Projects</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data?.totalProjectsCount ?? '--'}</span>
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
            {data?.activeProjectsCount ?? 0} active in-progress
          </span>
        </div>

        {/* 3. Staffs */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Staffs</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data?.activeEmployeesCount ?? '--'}</span>
          {hr.attendanceRateVal ? (
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{hr.attendanceRateVal}% present today</span>
          ) : (
            <span className="text-xs font-medium text-slate-400">Active workforce employees</span>
          )}
        </div>

        {/* 4. Students */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Students</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data?.activeStudentsCount ?? '--'}</span>
          {data?.newStudentsThisMonthCount > 0 ? (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{data.newStudentsThisMonthCount} new this month</span>
          ) : (
            <span className="text-xs font-medium text-slate-400">Enrolled academy students</span>
          )}
        </div>

        {/* 5. Total Tasks */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Tasks</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
              <ListTodo className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data?.totalTasksCount ?? '--'}</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {data?.completedTasksCount ?? 0} tasks completed
          </span>
        </div>

        {/* 7. Total Expenses */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Expenses</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
            ₹{(data?.totalExpenses || 0).toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">Approved operating expenditure</span>
        </div>

        {/* 8. Total Income */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Income</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
            ₹{(data?.totalIncome || 0).toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">Fee collections & revenue</span>
        </div>

        {/* 9. Total Purchases */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Purchases</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
            ₹{(data?.totalPurchases || 0).toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">Procurement & capital purchases</span>
        </div>
      </div>

      {/* EXECUTIVE VISUAL CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutivePieChart data={data} />
        <ExecutiveBarGraph data={data} />
      </div>
    </div>
  );
};

const MdDashboard = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '').trim() : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };
  }, []);

  const fetchMetrics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpointUrl = cleanBase.endsWith('/v1') ? `${cleanBase}/md-dashboard` : `${cleanBase}/v1/md-dashboard`;

      const res = await fetch(endpointUrl, {
        headers: getAuthHeaders()
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.data);
      } else if (!isSilent) {
        showToast(json.message || 'Failed to load MD Dashboard metrics', 'error');
      }
    } catch (err) {
      console.error(err);
      if (!isSilent) showToast('Error connecting to MD Dashboard service', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => {
      fetchMetrics(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 flex flex-col gap-4 max-w-7xl mx-auto">
      {/* EXECUTIVE HEADER */}
      <div className="px-5 py-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100">
              Managing Director Dashboard
            </h1>
            <span className="text-xs text-slate-400 font-medium">Consolidated Operations & Departmental Telemetry</span>
          </div>
        </div>

        <button
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
      </div>

      {/* DEPARTMENT DASHBOARD TABS BAR */}
      <div className="p-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-md overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-1 px-1">
          {DEPARTMENT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INLINE DEPARTMENT DASHBOARD CONTENT */}
      <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800">
        {activeTab === 'overview' && <OverallStatCards data={data} />}
        {activeTab === 'hr' && <HrDashboard />}
        {activeTab === 'attendance' && <Attendance />}
        {activeTab === 'accountant' && <AccountantDashboard />}
        {activeTab === 'academy' && <EnrollmentTracking />}
        {activeTab === 'marketing' && <MarketingDashboard />}
        {activeTab === 'counselor' && <CounselorDashboard />}
        {activeTab === 'developer' && <DeveloperDashboard />}
        {activeTab === 'graphic' && <GraphicDesignerDashboard />}
        {activeTab === 'video' && <VideographerDashboard />}
      </div>
    </div>
  );
};

export default MdDashboard;
