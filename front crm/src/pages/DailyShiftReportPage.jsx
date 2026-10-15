import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Clock, CheckCircle2, Save, RefreshCw, 
  User, Briefcase, Plus, Trash2, AlertCircle, Sparkles, 
  TrendingUp, ShieldCheck, ChevronRight, Activity, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getTodayDateStr = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
};

const getDayName = (dateStr) => {
  try {
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return 'Weekday';
  }
};

const DEFAULT_OPERATIONS = [
  { activity: 'CRM Lead Follow-ups & Pipeline Updates', dueDate: 'Today', startDate: '09:00 AM', endDate: '01:00 PM', status: 'Completed', remarks: 'All assigned queries contacted' },
  { activity: 'Academic Counseling & Student Demonstrations', dueDate: 'Today', startDate: '02:00 PM', endDate: '04:30 PM', status: 'Completed', remarks: 'Conducted course curriculum overviews' },
  { activity: 'Daily Batch Attendance & Escalation Resolution', dueDate: 'Today', startDate: '04:30 PM', endDate: '05:00 PM', status: 'Completed', remarks: 'Logged daily session attendance' }
];

const DEFAULT_SALES = [
  { activity: 'Outbound Consultation Calls', dueDate: 'Today', count: '45', digitalMktg: '25', web: '20', remarks: 'Good conversion potential' },
  { activity: 'Program Enrollment Demonstrations', dueDate: 'Today', count: '6', digitalMktg: '4', web: '2', remarks: '3 high-intent candidates' },
  { activity: 'Application Verifications & Fee Queries', dueDate: 'Today', count: '8', digitalMktg: '5', web: '3', remarks: 'Followed up on fee invoices' }
];

const DEFAULT_KPIS = [
  { kpi: 'Calls Connected', target: '40', achieved: '45' },
  { kpi: 'Demos / Consultations Completed', target: '5', achieved: '6' },
  { kpi: 'Pipeline Conversions Closed', target: '2', achieved: '2' },
  { kpi: 'Student Queries Handled', target: '10', achieved: '12' }
];

const DailyShiftReportPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const currentUserId = user._id || user.id || '';
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Form State
  const [basicDetails, setBasicDetails] = useState({
    date: selectedDate,
    day: getDayName(selectedDate),
    employeeName: user.name || '',
    employeeId: user.employeeId || user.studentId || (user.email ? user.email.split('@')[0] : 'EMP-001'),
    designation: user.designation || 'Academic Counselor / Operations Executive',
    department: user.department || 'Operations & Academics',
    shiftTiming: '09:00 AM - 05:00 PM',
    reportingTo: 'Manager - Operations & Academic Growth'
  });

  const [dailyOperations, setDailyOperations] = useState(DEFAULT_OPERATIONS);
  const [salesActivity, setSalesActivity] = useState(DEFAULT_SALES);
  const [performanceKpis, setPerformanceKpis] = useState(DEFAULT_KPIS);
  const [issuesFeedback, setIssuesFeedback] = useState([
    { issue: 'None', priority: 'Low', supportNeeded: 'Normal operations maintained' }
  ]);
  const [finalHandover, setFinalHandover] = useState({
    crmUpdated: 'Yes',
    reportsSubmitted: 'Yes'
  });

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch report for selected date
  const fetchReport = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const url = `${base}/daily-shift-reports/by-date?dateString=${dateStr}&userId=${currentUserId}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        throw new Error('Failed to load shift report');
      }

      const resData = await res.json();
      if (resData.success && resData.data) {
        const r = resData.data;
        setIsSaved(true);
        setLastSavedTime(r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Saved');

        if (r.basicDetails) {
          setBasicDetails(prev => ({
            ...prev,
            ...r.basicDetails,
            date: dateStr,
            day: getDayName(dateStr)
          }));
        }
        if (Array.isArray(r.dailyOperations) && r.dailyOperations.length > 0) {
          setDailyOperations(r.dailyOperations);
        }
        if (Array.isArray(r.salesActivity) && r.salesActivity.length > 0) {
          setSalesActivity(r.salesActivity);
        }
        if (Array.isArray(r.performanceKpis) && r.performanceKpis.length > 0) {
          setPerformanceKpis(r.performanceKpis);
        }
        if (Array.isArray(r.issuesFeedback) && r.issuesFeedback.length > 0) {
          setIssuesFeedback(r.issuesFeedback);
        }
        if (r.finalHandover) {
          setFinalHandover(r.finalHandover);
        }
      } else {
        // Not saved yet for this date: initialize with defaults and current user info
        setIsSaved(false);
        setLastSavedTime(null);
        setBasicDetails({
          date: dateStr,
          day: getDayName(dateStr),
          employeeName: user.name || '',
          employeeId: user.employeeId || user.studentId || (user.email ? user.email.split('@')[0] : 'EMP-001'),
          designation: user.designation || 'Academic Counselor / Operations Executive',
          department: user.department || 'Operations & Academics',
          shiftTiming: '09:00 AM - 05:00 PM',
          reportingTo: 'Manager - Operations & Academic Growth'
        });
        setDailyOperations(DEFAULT_OPERATIONS);
        setSalesActivity(DEFAULT_SALES);
        setPerformanceKpis(DEFAULT_KPIS);
        setIssuesFeedback([
          { issue: 'None', priority: 'Low', supportNeeded: 'Normal operations maintained' }
        ]);
        setFinalHandover({ crmUpdated: 'Yes', reportsSubmitted: 'Yes' });
      }
    } catch (err) {
      console.warn('Daily shift report fetch fallback:', err.message);
      setIsSaved(false);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getHeaders, user]);

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate, fetchReport]);

  // Handle Save / Submit
  const handleSaveReport = async () => {
    setSaving(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const url = `${base}/daily-shift-reports`;

      const payload = {
        userId: currentUserId,
        dateString: selectedDate,
        basicDetails: {
          ...basicDetails,
          date: selectedDate,
          day: getDayName(selectedDate)
        },
        dailyOperations,
        salesActivity,
        performanceKpis,
        issuesFeedback,
        finalHandover,
        approval: {
          counselorName: user.name || basicDetails.employeeName,
          counselorDate: selectedDate
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Failed to save shift report');
      }

      setIsSaved(true);
      setLastSavedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      showToast('Daily Shift Report successfully saved and verified!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Row helpers for operations
  const addOperationRow = () => {
    setDailyOperations(prev => [
      ...prev,
      { activity: '', dueDate: 'Today', startDate: '09:00 AM', endDate: '05:00 PM', status: 'In Progress', remarks: '' }
    ]);
  };

  const removeOperationRow = (index) => {
    setDailyOperations(prev => prev.filter((_, i) => i !== index));
  };

  const updateOperation = (index, field, value) => {
    setDailyOperations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Row helpers for sales / outreach
  const addSalesRow = () => {
    setSalesActivity(prev => [
      ...prev,
      { activity: '', dueDate: 'Today', count: '0', digitalMktg: '0', web: '0', remarks: '' }
    ]);
  };

  const removeSalesRow = (index) => {
    setSalesActivity(prev => prev.filter((_, i) => i !== index));
  };

  const updateSales = (index, field, value) => {
    setSalesActivity(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // KPI update helper
  const updateKpi = (index, field, value) => {
    setPerformanceKpis(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
            <Clock size={13} className="text-amber-500" /> Daily Shift & Counselor Work Log
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Daily Shift Report
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Submit your shift activities, outreach metrics, operations, and compliance tasks before logout.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-1.5 shadow-xs">
            <Calendar size={14} className="text-slate-400 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>

          <button
            onClick={() => fetchReport(selectedDate)}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs"
            title="Refresh Report Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={saving || loading}
            onClick={handleSaveReport}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs tracking-wide shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              isSaved
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20'
            }`}
          >
            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 size={15} />
            ) : (
              <Save size={15} />
            )}
            <span>{isSaved ? 'Update Saved Report' : 'Save Shift Report'}</span>
          </motion.button>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        isSaved 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      }`}>
        <div className="flex items-center gap-2.5">
          {isSaved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-amber-500" />}
          <div>
            <span className="font-bold text-slate-900 dark:text-white">
              {isSaved ? 'Shift Report Verified & Submitted' : 'Draft / Unsaved Shift Report'}
            </span>
            <span className="text-slate-500 dark:text-slate-400 ml-2">
              for {selectedDate} ({getDayName(selectedDate)})
            </span>
          </div>
        </div>
        {lastSavedTime && (
          <span className="text-[11px] font-mono text-slate-400">
            Last updated at {lastSavedTime}
          </span>
        )}
      </div>

      {/* SECTION 1: BASIC EMPLOYEE DETAILS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <User size={18} className="text-indigo-500" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Employee & Shift Overview
            </h2>
          </div>
          <span className="text-xs font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-xl">
            Section 1 / 4
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Employee Name
            </label>
            <input
              type="text"
              value={basicDetails.employeeName}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, employeeName: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Employee ID
            </label>
            <input
              type="text"
              value={basicDetails.employeeId}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, employeeId: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Designation
            </label>
            <input
              type="text"
              value={basicDetails.designation}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, designation: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Department
            </label>
            <input
              type="text"
              value={basicDetails.department}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, department: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Shift Timing
            </label>
            <input
              type="text"
              value={basicDetails.shiftTiming}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, shiftTiming: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Reporting Manager
            </label>
            <input
              type="text"
              value={basicDetails.reportingTo}
              onChange={(e) => setBasicDetails(prev => ({ ...prev, reportingTo: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Report Date
            </label>
            <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
              {selectedDate}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Day of Week
            </label>
            <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              {getDayName(selectedDate)}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DAILY OPERATIONAL TASKS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Activity size={18} className="text-cyan-500" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Daily Shift Operations & Activities
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Key operational duties performed during today’s working hours.
              </p>
            </div>
          </div>
          <button
            onClick={addOperationRow}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Plus size={13} /> Add Task
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3">Activity / Duty</th>
                <th className="py-3 px-3 w-28">Start</th>
                <th className="py-3 px-3 w-28">End</th>
                <th className="py-3 px-3 w-32">Status</th>
                <th className="py-3 px-3">Remarks / Outcome</th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dailyOperations.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.activity}
                      onChange={(e) => updateOperation(idx, 'activity', e.target.value)}
                      placeholder="Task description..."
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.startDate}
                      onChange={(e) => updateOperation(idx, 'startDate', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.endDate}
                      onChange={(e) => updateOperation(idx, 'endDate', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={row.status}
                      onChange={(e) => updateOperation(idx, 'status', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="Completed">Completed</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending">Pending</option>
                      <option value="Deferred">Deferred</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) => updateOperation(idx, 'remarks', e.target.value)}
                      placeholder="Notes..."
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => removeOperationRow(idx)}
                      disabled={dailyOperations.length === 1}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded disabled:opacity-30 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: COUNSELING & OUTREACH METRICS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-emerald-500" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Admissions Outreach & Counseling Volume
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log calling numbers, demo sessions, and lead pipeline communications.
              </p>
            </div>
          </div>
          <button
            onClick={addSalesRow}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Plus size={13} /> Add Metric
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3">Outreach Channel / Activity</th>
                <th className="py-3 px-3 w-24">Total Count</th>
                <th className="py-3 px-3 w-24">Digital Mktg</th>
                <th className="py-3 px-3 w-24">Website Leads</th>
                <th className="py-3 px-3">Remarks</th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {salesActivity.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.activity}
                      onChange={(e) => updateSales(idx, 'activity', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={row.count}
                      onChange={(e) => updateSales(idx, 'count', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={row.digitalMktg}
                      onChange={(e) => updateSales(idx, 'digitalMktg', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={row.web}
                      onChange={(e) => updateSales(idx, 'web', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) => updateSales(idx, 'remarks', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => removeSalesRow(idx)}
                      disabled={salesActivity.length === 1}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded disabled:opacity-30 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: PERFORMANCE KPIS & HANDOVER COMPLIANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Performance Targets */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Sparkles size={18} className="text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Shift Performance KPIs
            </h2>
          </div>

          <div className="space-y-3">
            {performanceKpis.map((kpi, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {kpi.kpi}
                </span>
                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-medium">
                    Target:
                  </div>
                  <input
                    type="text"
                    value={kpi.target}
                    onChange={(e) => updateKpi(idx, 'target', e.target.value)}
                    className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-medium ml-1">
                    Achieved:
                  </div>
                  <input
                    type="text"
                    value={kpi.achieved}
                    onChange={(e) => updateKpi(idx, 'achieved', e.target.value)}
                    className="w-14 bg-white dark:bg-slate-900 border border-emerald-500/50 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-center outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Final Handover & Sign-off */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ShieldCheck size={18} className="text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Final Shift Handover & Compliance
              </h2>
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">CRM Leads & Notes Updated</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">All call dispositions logged in database</div>
                </div>
                <select
                  value={finalHandover.crmUpdated}
                  onChange={(e) => setFinalHandover(prev => ({ ...prev, crmUpdated: e.target.value }))}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Daily Reports Submitted</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Shift report verified for manager review</div>
                </div>
                <select
                  value={finalHandover.reportsSubmitted}
                  onChange={(e) => setFinalHandover(prev => ({ ...prev, reportsSubmitted: e.target.value }))}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving || loading}
              onClick={handleSaveReport}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-xs tracking-wide shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaved ? 'Save Updated Shift Log' : 'Save & Submit Shift Report'}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyShiftReportPage;
