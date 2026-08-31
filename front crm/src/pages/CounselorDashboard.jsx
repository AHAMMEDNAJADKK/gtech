import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, BarChart3, RefreshCw, ChevronRight,
  ArrowUpRight, ArrowDownRight, Award, PieChart, CheckCircle2,
  Phone, Mail, Briefcase, Tag, Calendar, Clock, Target,
  Zap, ShieldAlert, Loader2, Eye, Activity, Building2, UserCheck, Filter
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const rawApiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase.slice(0, -3) : rawApiBase;

/* ─── Color map for Course Interest ─── */
const INTEREST_COLORS = {
  'HOT LEAD':     { bg: 'bg-green-200',  bar: 'from-green-500 to-emerald-400',  text: 'text-green-700',  dot: 'bg-green-500' },
  'WARM LEAD':    { bg: 'bg-sky-200',    bar: 'from-sky-500 to-cyan-400',       text: 'text-sky-700',    dot: 'bg-sky-500' },
  'COLD LEAD':    { bg: 'bg-red-200',    bar: 'from-red-500 to-rose-400',       text: 'text-red-700',    dot: 'bg-red-500' },
  'WRONG LEAD':   { bg: 'bg-yellow-200', bar: 'from-yellow-500 to-amber-400',   text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'RNT':          { bg: 'bg-purple-200', bar: 'from-purple-500 to-violet-400',  text: 'text-purple-700', dot: 'bg-purple-500' },
  'SWITCHED OFF': { bg: 'bg-pink-200',   bar: 'from-pink-500 to-rose-400',      text: 'text-pink-700',   dot: 'bg-pink-500' },
  'CALL BACK':    { bg: 'bg-slate-200',  bar: 'from-slate-500 to-gray-400',     text: 'text-slate-700',  dot: 'bg-slate-500' },
};

const STATUS_COLORS = {
  'New':        { bar: 'from-blue-500 to-indigo-400',    dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' },
  'Contacted':  { bar: 'from-indigo-500 to-violet-400',  dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400' },
  'Follow Up':  { bar: 'from-amber-500 to-yellow-400',   dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  'Interested': { bar: 'from-purple-500 to-fuchsia-400', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' },
  'Converted':  { bar: 'from-emerald-500 to-lime-400',   dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
  'Lost':       { bar: 'from-rose-500 to-red-400',       dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' },
};

const SOURCE_COLORS = {
  'REFERENCE':     { bar: 'from-violet-500 to-purple-400', dot: 'bg-violet-500' },
  'INBOUND CALLS': { bar: 'from-cyan-500 to-teal-400',    dot: 'bg-cyan-500' },
  'INBOUND MSG':   { bar: 'from-blue-500 to-sky-400',     dot: 'bg-blue-500' },
  'MARKETING':     { bar: 'from-orange-500 to-amber-400', dot: 'bg-orange-500' },
};

const CounselorDashboard = () => {
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [clientLeads, setClientLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'students' | 'clients'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch (e) { console.error(e); }
  }, []);

  const hasAccess = useMemo(() => {
    return true;
  }, []);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const headers = getAuthHeaders();

      // Fetch Student/Telecaller Leads
      const studentPromise = fetch(`${API_BASE}/v1/leads`, { headers })
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) return json.data;
          if (Array.isArray(json)) return json;
          return [];
        })
        .catch(e => {
          console.error("Error fetching student leads:", e);
          return [];
        });

      // Fetch Client Leads
      const clientPromise = fetch(`${API_BASE}/v1/client-leads?limit=1000`, { headers })
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) return json.data;
          if (Array.isArray(json)) return json;
          return [];
        })
        .catch(e => {
          console.error("Error fetching client leads:", e);
          return [];
        });

      const [studentData, clientData] = await Promise.all([studentPromise, clientPromise]);

      setLeads(studentData);
      setClientLeads(clientData);

      if (silent) showToast('Dashboard refreshed with latest Student & Client leads!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to load dashboard data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    if (user && hasAccess) fetchAllData();
  }, [user, hasAccess, fetchAllData]);

  /* ─── Student Leads Analytics ─── */
  const studentAnalytics = useMemo(() => {
    if (!leads.length) return null;

    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = leads.length;
    const newLeads24h = leads.filter(l => new Date(l.createdAt || Date.now()) >= past24h).length;
    const mtdLeads = leads.filter(l => new Date(l.createdAt || Date.now()) >= startOfMonth).length;
    const converted = leads.filter(l => l.status === 'Converted').length;
    const lost = leads.filter(l => l.status === 'Lost').length;
    const followUpPending = leads.filter(l => l.status === 'Follow Up').length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

    const admissionYes = leads.filter(l => l.admissionYesNo === 'Yes').length;
    const meetingYes = leads.filter(l => l.clientMeetingFixed === 'Yes').length;

    const statusBreakdown = {};
    leads.forEach(l => {
      const s = l.status || 'New';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    const interestBreakdown = {};
    leads.forEach(l => {
      const s = (l.interestedService || '').trim().toUpperCase();
      if (s) interestBreakdown[s] = (interestBreakdown[s] || 0) + 1;
    });

    const sourceBreakdown = {};
    leads.forEach(l => {
      const s = (l.source || '').trim().toUpperCase();
      if (s) sourceBreakdown[s] = (sourceBreakdown[s] || 0) + 1;
    });

    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const dayStr = new Intl.DateTimeFormat('en-CA').format(day);
      const count = leads.filter(l => {
        if (!l.createdAt) return false;
        try {
          const cd = new Intl.DateTimeFormat('en-CA').format(new Date(l.createdAt));
          return cd === dayStr;
        } catch (e) { return false; }
      }).length;
      weeklyTrend.push({ date: dayStr, label: day.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), count });
    }

    const recentLeads = [...leads]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);

    return {
      total, newLeads24h, mtdLeads, converted, lost, followUpPending,
      conversionRate, admissionYes, meetingYes,
      statusBreakdown, interestBreakdown, sourceBreakdown,
      weeklyTrend, recentLeads
    };
  }, [leads]);

  /* ─── Client Leads Analytics ─── */
  const clientAnalytics = useMemo(() => {
    if (!clientLeads.length) return null;

    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = clientLeads.length;
    const newLeads24h = clientLeads.filter(l => new Date(l.createdAt || l.date || Date.now()) >= past24h).length;
    const mtdLeads = clientLeads.filter(l => new Date(l.createdAt || l.date || Date.now()) >= startOfMonth).length;

    const converted = clientLeads.filter(l => {
      const st = String(l.status || '').toLowerCase();
      return st === 'converted' || st === 'won' || st === 'closed / won' || st === 'closed/won';
    }).length;

    const lost = clientLeads.filter(l => {
      const st = String(l.status || '').toLowerCase();
      return st === 'lost' || st === 'closed / lost' || st === 'closed/lost';
    }).length;

    const followUpPending = clientLeads.filter(l => {
      const st = String(l.status || '').toLowerCase();
      return st === 'follow up' || st === 'follow-up' || st === 'contacted' || st === 'in negotiation';
    }).length;

    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

    const statusBreakdown = {};
    clientLeads.forEach(l => {
      const s = l.status || 'New';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    const serviceBreakdown = {};
    clientLeads.forEach(l => {
      const s = (l.service || l.interestedService || l.requirement || l.serviceRequested || 'General Business Inquiry').trim();
      if (s) serviceBreakdown[s] = (serviceBreakdown[s] || 0) + 1;
    });

    const recentClientLeads = [...clientLeads]
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
      .slice(0, 8);

    return {
      total, newLeads24h, mtdLeads, converted, lost, followUpPending,
      conversionRate, statusBreakdown, serviceBreakdown, recentClientLeads
    };
  }, [clientLeads]);

  /* ─── Combined Analytics Summary ─── */
  const combinedAnalytics = useMemo(() => {
    const sTotal = studentAnalytics?.total || 0;
    const cTotal = clientAnalytics?.total || 0;
    const total = sTotal + cTotal;

    const sNew = studentAnalytics?.newLeads24h || 0;
    const cNew = clientAnalytics?.newLeads24h || 0;
    const newLeads24h = sNew + cNew;

    const sFollow = studentAnalytics?.followUpPending || 0;
    const cFollow = clientAnalytics?.followUpPending || 0;
    const followUpPending = sFollow + cFollow;

    const sConv = studentAnalytics?.converted || 0;
    const cConv = clientAnalytics?.converted || 0;
    const converted = sConv + cConv;

    const sMtd = studentAnalytics?.mtdLeads || 0;
    const cMtd = clientAnalytics?.mtdLeads || 0;
    const mtdLeads = sMtd + cMtd;

    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

    return {
      total, sTotal, cTotal, newLeads24h, followUpPending, converted, mtdLeads, conversionRate
    };
  }, [studentAnalytics, clientAnalytics]);

  /* ─── Access Denied ─── */
  if (user && !hasAccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6">
            <ShieldAlert size={36} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">
            Access <span className="text-red-500">Restricted</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            This Lead Dashboard is reserved for authorized departments only.
          </p>
          <button onClick={() => window.location.href = '/dashboard'}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer">
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Loading Counselor & Client Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30">
              <BarChart3 size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-wider rounded-md">
                  Telecaller & Corporate Analytics
                </span>
                <span className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-lime-500 font-bold uppercase">Live</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                Counselor & Client Leads Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={() => fetchAllData(true)} disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => window.location.href = '/leads-telecaller'}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer">
              <Users size={14} />
              Student Leads
            </button>
            <button onClick={() => window.location.href = '/client-leads'}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
              <Building2 size={14} />
              Client Leads
            </button>
          </div>
        </div>

        {/* ─── Tab Switcher Bar ─── */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xs max-w-md">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Filter size={13} />
            <span>All Leads ({combinedAnalytics.total})</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users size={13} />
            <span>Student ({combinedAnalytics.sTotal})</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'clients'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 size={13} />
            <span>Client ({combinedAnalytics.cTotal})</span>
          </button>
        </div>

        {/* ─── KPI Summary Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {activeTab === 'all' && (
            <>
              <KpiCard icon={<Target size={20} />} label="Total Inquiries" value={combinedAnalytics.total} color="indigo" />
              <KpiCard icon={<Users size={20} />} label="Student Leads" value={combinedAnalytics.sTotal} color="cyan" />
              <KpiCard icon={<Building2 size={20} />} label="Client Leads" value={combinedAnalytics.cTotal} color="emerald" />
              <KpiCard icon={<Zap size={20} />} label="New (24h)" value={combinedAnalytics.newLeads24h} color="amber" />
              <KpiCard icon={<Clock size={20} />} label="Follow-Up" value={combinedAnalytics.followUpPending} color="violet" />
              <KpiCard icon={<CheckCircle2 size={20} />} label="Total Converted" value={combinedAnalytics.converted} sub={`${combinedAnalytics.conversionRate}%`} color="sky" />
            </>
          )}

          {activeTab === 'students' && studentAnalytics && (
            <>
              <KpiCard icon={<Target size={20} />} label="Total Student Leads" value={studentAnalytics.total} color="indigo" />
              <KpiCard icon={<Zap size={20} />} label="New (24h)" value={studentAnalytics.newLeads24h} color="cyan" />
              <KpiCard icon={<Clock size={20} />} label="Follow-Up" value={studentAnalytics.followUpPending} color="amber" />
              <KpiCard icon={<CheckCircle2 size={20} />} label="Converted" value={studentAnalytics.converted} sub={`${studentAnalytics.conversionRate}%`} color="emerald" />
              <KpiCard icon={<Award size={20} />} label="Admissions" value={studentAnalytics.admissionYes} color="violet" />
              <KpiCard icon={<Eye size={20} />} label="Meetings Fixed" value={studentAnalytics.meetingYes} color="sky" />
            </>
          )}

          {activeTab === 'clients' && clientAnalytics && (
            <>
              <KpiCard icon={<Building2 size={20} />} label="Total Client Leads" value={clientAnalytics.total} color="emerald" />
              <KpiCard icon={<Zap size={20} />} label="New (24h)" value={clientAnalytics.newLeads24h} color="cyan" />
              <KpiCard icon={<Clock size={20} />} label="Follow-Up Pending" value={clientAnalytics.followUpPending} color="amber" />
              <KpiCard icon={<CheckCircle2 size={20} />} label="Clients Won" value={clientAnalytics.converted} sub={`${clientAnalytics.conversionRate}%`} color="indigo" />
              <KpiCard icon={<Calendar size={20} />} label="MTD Client Leads" value={clientAnalytics.mtdLeads} color="violet" />
              <KpiCard icon={<TrendingUp size={20} />} label="Conversion Rate" value={`${clientAnalytics.conversionRate}%`} color="rose" />
            </>
          )}
        </div>

        {/* ─── Client Leads Section (Shown in 'all' and 'clients' tab) ─── */}
        {(activeTab === 'all' || activeTab === 'clients') && clientAnalytics && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                Corporate & Client Leads Pipeline
              </h2>
              <button
                onClick={() => window.location.href = '/client-leads'}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                View Full Client CRM <ChevronRight size={14} />
              </button>
            </div>

            {/* Client Status & Service Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Client Status Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                  Client Lead Status Pipeline
                </h3>
                <div className="space-y-3">
                  {['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost'].map((status, idx) => {
                    const count = clientAnalytics.statusBreakdown[status] || 0;
                    const pct = clientAnalytics.total > 0 ? Math.round((count / clientAnalytics.total) * 100) : 0;
                    const colors = STATUS_COLORS[status] || { bar: 'from-emerald-500 to-teal-400', dot: 'bg-emerald-500' };
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-xs mb-1 px-1">
                          <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                            {status}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-white">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-xl overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 2)}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.08 }}
                            className={`h-full bg-gradient-to-r ${colors.bar} rounded-xl flex items-center pl-3`}
                          >
                            <span className="text-[9px] font-bold text-white/90 uppercase tracking-wider">{status}</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Client Services & Requirement Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-teal-500 rounded-full" />
                  Client Requirement / Service Breakdown
                </h3>
                {Object.keys(clientAnalytics.serviceBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">No service requirement data recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(clientAnalytics.serviceBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([service, count]) => {
                        const max = Math.max(...Object.values(clientAnalytics.serviceBreakdown), 1);
                        const pct = Math.round((count / max) * 100);
                        const totalPct = clientAnalytics.total > 0 ? Math.round((count / clientAnalytics.total) * 100) : 0;
                        return (
                          <div key={service}>
                            <div className="flex items-center justify-between text-xs mb-1 px-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                {service}
                              </span>
                              <span className="font-mono font-bold text-slate-800 dark:text-white">{count} <span className="text-slate-400 font-normal">({totalPct}%)</span></span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-lg overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(pct, 3)}%` }}
                                transition={{ duration: 0.7 }}
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-lg"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Client Leads Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                  Recent Client Leads & Corporate Inquiries
                </h3>
                <button onClick={() => window.location.href = '/client-leads'}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider hover:underline cursor-pointer flex items-center gap-1 transition">
                  Manage All Client Leads <ChevronRight size={12} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Client / Business</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Details</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Service / Requirement</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned To</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clientAnalytics.recentClientLeads.map(clead => {
                      const nameStr = clead.clientName || clead.leadName || clead.name || clead.client_name || 'Client Lead';
                      const companyStr = clead.companyName || clead.company_name || clead.company || '';
                      const serviceStr = clead.service || clead.interestedService || clead.requirement || clead.serviceRequested || 'General Inquiry';
                      const statusStr = clead.status || 'New';
                      const sBadge = STATUS_COLORS[statusStr]?.badge || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                      return (
                        <tr key={clead.id || clead._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                                <Building2 size={13} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-white block">{nameStr}</span>
                                {companyStr && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Briefcase size={9} /> {companyStr}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <div className="space-y-0.5">
                              {clead.phone && (
                                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                  <Phone size={10} className="text-slate-400" /> {clead.phone}
                                </div>
                              )}
                              {clead.email && (
                                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                                  <Mail size={10} /> {clead.email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50">
                              <Tag size={9} /> {serviceStr}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            {clead.assignedTo || clead.assignedCounselor || clead.counselor || 'Unassigned'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sBadge}`}>
                              {statusStr}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            {clead.createdAt || clead.date ? new Date(clead.createdAt || clead.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Student Leads Main Grid (Shown in 'all' and 'students' tab) ─── */}
        {(activeTab === 'all' || activeTab === 'students') && studentAnalytics && (
          <div className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                Student & Telecaller Leads Pipeline
              </h2>
              <button
                onClick={() => window.location.href = '/leads-telecaller'}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                View Full Student Leads <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Status Funnel (2 cols) */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-indigo-500 rounded-full" />
                  Student Lead Status Funnel
                </h3>
                <div className="space-y-3">
                  {['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost'].map((status, idx) => {
                    const count = studentAnalytics.statusBreakdown[status] || 0;
                    const pct = studentAnalytics.total > 0 ? Math.round((count / studentAnalytics.total) * 100) : 0;
                    const colors = STATUS_COLORS[status] || { bar: 'from-slate-500 to-gray-400', dot: 'bg-slate-500' };
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-xs mb-1 px-1">
                          <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                            {status}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-white">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-7 rounded-xl overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 2)}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.08 }}
                            className={`h-full bg-gradient-to-r ${colors.bar} rounded-xl flex items-center pl-3`}
                          >
                            <span className="text-[9px] font-bold text-white/90 uppercase tracking-wider">{status}</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Trend (1 col) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-cyan-500 rounded-full" />
                  Student Leads This Week
                </h3>
                <div className="flex items-end justify-between h-44 pt-4 gap-1">
                  {studentAnalytics.weeklyTrend.map((day, idx) => {
                    const max = Math.max(...studentAnalytics.weeklyTrend.map(d => d.count), 1);
                    const hPct = Math.round((day.count / max) * 100);
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
                        <span className="text-[10px] font-extrabold text-slate-650 dark:text-slate-300 font-mono mb-1 transition-colors group-hover:text-indigo-500">
                          {day.count}
                        </span>
                        
                        <div className="w-full flex items-end justify-center h-28 relative">
                          <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-100/40 dark:bg-slate-800/10 rounded-t-md w-full max-w-[20px] mx-auto border border-dashed border-slate-200/20 dark:border-slate-800/10" />
                          
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ duration: 0.6, delay: idx * 0.08 }}
                            style={{ height: `${Math.max(hPct, 2)}%`, transformOrigin: 'bottom' }}
                            className="w-full max-w-[20px] bg-gradient-to-t from-indigo-500 to-purple-400 group-hover:from-indigo-400 group-hover:to-purple-300 rounded-t-md transition-colors min-h-[2px] cursor-pointer relative z-10 shadow-sm"
                          />
                        </div>
                        
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 font-black mt-2 tracking-tight uppercase">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">MTD Student Total</span>
                  <span className="text-sm font-black text-indigo-500 font-mono">{studentAnalytics.mtdLeads}</span>
                </div>
              </div>
            </div>

            {/* Course Interest & Source Attribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Course Interest Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                  Course Interest Breakdown
                </h3>
                {Object.keys(studentAnalytics.interestBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">No course interest data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(studentAnalytics.interestBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([interest, count]) => {
                        const max = Math.max(...Object.values(studentAnalytics.interestBreakdown), 1);
                        const pct = Math.round((count / max) * 100);
                        const totalPct = studentAnalytics.total > 0 ? Math.round((count / studentAnalytics.total) * 100) : 0;
                        const colors = INTEREST_COLORS[interest] || { bar: 'from-slate-500 to-gray-400', dot: 'bg-slate-400' };
                        return (
                          <div key={interest}>
                            <div className="flex items-center justify-between text-xs mb-1 px-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                {interest}
                              </span>
                              <span className="font-mono font-bold text-slate-800 dark:text-white">{count} <span className="text-slate-400 font-normal">({totalPct}%)</span></span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-lg overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(pct, 3)}%` }}
                                transition={{ duration: 0.7 }}
                                className={`h-full bg-gradient-to-r ${colors.bar} rounded-lg`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Source Attribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 bg-violet-500 rounded-full" />
                  Source Attribution
                </h3>
                {Object.keys(studentAnalytics.sourceBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">No source data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(studentAnalytics.sourceBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => {
                        const max = Math.max(...Object.values(studentAnalytics.sourceBreakdown), 1);
                        const pct = Math.round((count / max) * 100);
                        const totalPct = studentAnalytics.total > 0 ? Math.round((count / studentAnalytics.total) * 100) : 0;
                        const colors = SOURCE_COLORS[source] || { bar: 'from-slate-500 to-gray-400', dot: 'bg-slate-400' };
                        return (
                          <div key={source}>
                            <div className="flex items-center justify-between text-xs mb-1 px-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                {source}
                              </span>
                              <span className="font-mono font-bold text-slate-800 dark:text-white">{count} <span className="text-slate-400 font-normal">({totalPct}%)</span></span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-lg overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(pct, 3)}%` }}
                                transition={{ duration: 0.7 }}
                                className={`h-full bg-gradient-to-r ${colors.bar} rounded-lg`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Student Leads Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full" />
                  Recent Student Leads
                </h3>
                <button onClick={() => window.location.href = '/leads-telecaller'}
                  className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider hover:text-indigo-400 cursor-pointer flex items-center gap-1 transition">
                  View All Student Leads <ChevronRight size={12} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Name</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Course Interest</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Source</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {studentAnalytics.recentLeads.map(lead => {
                      const interest = (lead.interestedService || '').trim().toUpperCase();
                      const iColors = INTEREST_COLORS[interest];
                      return (
                        <tr key={lead.id || lead._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-white">{lead.leadName}</span>
                            {lead.companyName && (
                              <span className="block text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Briefcase size={9} /> {lead.companyName}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <Phone size={10} className="text-slate-400" /> {lead.phone}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {interest ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${iColors ? `${iColors.bg} ${iColors.text}` : 'bg-slate-100 text-slate-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${iColors?.dot || 'bg-slate-400'}`} />
                                {interest}
                              </span>
                            ) : <span className="text-[10px] text-slate-400 italic">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase">{lead.source || '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              lead.status === 'Converted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              lead.status === 'Lost' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {lead.status || 'New'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!studentAnalytics && !clientAnalytics && !loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm text-center">
            <Activity className="text-slate-300 dark:text-slate-700 mb-4" size={48} />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No leads data available</h3>
            <p className="text-xs text-slate-400 mt-1">Add student or client leads to see analytics here.</p>
          </div>
        )}

      </div>
    </div>
  );
};

/* ─── KPI Card Component ─── */
const KpiCard = ({ icon, label, value, sub, color }) => {
  const colorMap = {
    indigo:  'from-indigo-500/15 to-indigo-500/5 border-indigo-500/20 text-indigo-500',
    cyan:    'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20 text-cyan-500',
    amber:   'from-amber-500/15 to-amber-500/5 border-amber-500/20 text-amber-500',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20 text-emerald-500',
    violet:  'from-violet-500/15 to-violet-500/5 border-violet-500/20 text-violet-500',
    sky:     'from-sky-500/15 to-sky-500/5 border-sky-500/20 text-sky-500',
    rose:    'from-rose-500/15 to-rose-500/5 border-rose-500/20 text-rose-500',
  };
  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${scheme} border rounded-2xl p-4 relative overflow-hidden group hover:shadow-md transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{label}</div>
      {sub && <div className="text-[10px] font-bold text-emerald-500 mt-0.5">{sub} rate</div>}
    </motion.div>
  );
};

export default CounselorDashboard;
