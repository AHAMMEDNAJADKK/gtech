import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Award, TrendingUp, ShieldCheck, 
  Download, Search, CheckCircle2, ArrowUpRight, AlertTriangle, Crown, Shield, User
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { getKpiColorCode } from '../components/PerformanceTab';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '').replace(/\/v1$/, '');

const STATUS_OPTIONS = [
  'Outstanding',
  'Excellent',
  'Better',
  'Good',
  'Needs Improvement',
  'Bad',
  'Very Bad'
];

const PerformanceDashboard = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportType, setReportType] = useState('monthly');
  const [reportsData, setReportsData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Role resolution
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = String(currentUser?.role || currentUser?.role_id || currentUser?.roleId || '').toLowerCase().trim();
  const deptName = String(currentUser?.department || currentUser?.departmentId?.name || currentUser?.department_name || '').toLowerCase().trim();

  const isSuperAdmin = userRole === '0' || userRole === 'superadmin' || currentUser.isSuperAdmin === true;
  const isAdmin = isSuperAdmin || ['2', 'admin'].includes(userRole);
  const isHrDept = deptName.includes('hr') || deptName.includes('human resource');

  // Discrete role checks
  const isHR = !isAdmin && (['1', 'hr'].includes(userRole) || String(currentUser?.designation || '').toLowerCase().includes('hr') || isHrDept);
  const isTeamLead = !isAdmin && !isHR && (['team_lead', 'teamlead', 'tl', '10', 'team lead', 'manager', 'lead'].includes(userRole) || !!currentUser?.isTeamLead);

  const [savingRowId, setSavingRowId] = useState(null);
  const [savedRowId, setSavedRowId] = useState(null);
  const debounceTimers = useRef({});

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` };
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/performance/analytics?month=${month}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [month, getAuthHeaders]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/performance/reports?type=${reportType}&month=${month}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data?.records) {
        setReportsData(data.data.records);
      }
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
  }, [reportType, month, getAuthHeaders]);

  useEffect(() => {
    fetchAnalytics();
    fetchReports();
  }, [fetchAnalytics, fetchReports]);

  const handleRowChange = (idx, field, value) => {
    setReportsData(prev => {
      const updated = [...prev];
      const row = { ...updated[idx], [field]: value };
      updated[idx] = row;

      // Debounced auto-save: 1.5s delay
      const rowId = row._id || idx;
      if (debounceTimers.current[rowId]) clearTimeout(debounceTimers.current[rowId]);
      debounceTimers.current[rowId] = setTimeout(() => {
        handleSaveRow(row);
      }, 1500);

      return updated;
    });
  };

  const handleSaveRow = async (row) => {
    try {
      setSavingRowId(row._id);
      const payload = {
        employeeId: row._id,
        month,
        status: row.status || row.grade || 'Good',
        remarks: row.remarks || ''
      };

      if (isAdmin) {
        payload.adminRating = Number(row.adminRating ?? 5);
        payload.adminRemark = row.adminRemark || '';
      } else if (isHR) {
        payload.hrRating = Number(row.hrRating ?? 5);
        payload.hrRemark = row.hrRemark || '';
      } else if (isTeamLead) {
        payload.tlRating = Number(row.tlRating ?? 5);
        payload.tlRemark = row.tlRemark || '';
      }

      const res = await fetch(`${API_BASE}/v1/performance/update-record`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (data.data?.kpiScore !== undefined || data.data?.grade !== undefined) {
          setReportsData(prev => prev.map(r => {
            if (r._id === row._id) {
              return {
                ...r,
                kpiScore: data.data.kpiScore ?? r.kpiScore,
                grade: data.data.grade ?? r.grade
              };
            }
            return r;
          }));
        }
        setSavedRowId(row._id);
        setTimeout(() => setSavedRowId(null), 3000);
      } else {
        showToast(data.message || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error("Save evaluation error:", err);
    } finally {
      setSavingRowId(null);
    }
  };

  const handleExportCSV = () => {
    if (!reportsData.length) {
      showToast('No report records to export.', 'warning');
      return;
    }
    const headers = ['Employee Name', 'Employee ID', 'Department', 'KPI Score', 'Grade', 'HR Rating', 'TL Rating', 'Admin Rating', 'Performance Status'];
    const rows = reportsData.map(r => [
      `"${r.employeeName}"`,
      `"${r.employeeId}"`,
      `"${r.department}"`,
      r.kpiScore,
      `"${r.grade}"`,
      r.hrRating || '',
      r.tlRating || '',
      r.adminRating || '',
      `"${r.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KPI_Performance_Report_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV report exported successfully!', 'success');
  };

  const filteredReports = reportsData.filter(r => {
    const d = String(r.department || '').toLowerCase();
    const des = String(r.designation || '').toLowerCase();
    const role = String(r.role || '').toLowerCase();
    if (d === 'student' || d === 'students' || d === 'academy students' || des.includes('student') || role.includes('student')) {
      return false;
    }
    return (
      r.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.grade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-12">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Top Header ── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 italic tracking-tighter uppercase leading-none">
              ENTERPRISE <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-lime-400">KPI ANALYTICS</span>
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              {isAdmin ? 'Admin Master Performance Evaluation & Ratings' : isHR ? 'HR Department Performance Ratings' : 'Team Lead Performance Ratings'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
            <button
              onClick={handleExportCSV}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        </header>

        {/* ── Metric Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Average KPI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Average System KPI</span>
              <TrendingUp size={20} className="text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {analytics?.averageKPI || 0}%
              </span>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center">
                <ArrowUpRight size={12} /> Live Score
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Active Evaluated Staff: {analytics?.totalEvaluated || 0}</p>
          </div>

          {/* Highest Performer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Performer</span>
              <Award size={20} className="text-amber-500" />
            </div>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100 block truncate">
              {analytics?.highestPerformer?.name || 'N/A'}
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-black text-amber-500">{analytics?.highestPerformer?.score || 0}% Score</span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {analytics?.highestPerformer?.grade || 'N/A'}
              </span>
            </div>
          </div>

          {/* Top Department */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Department</span>
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100 block truncate uppercase">
              {analytics?.topDepartment || 'Operations'}
            </span>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Top Team Lead: <strong className="text-slate-700 dark:text-slate-300">{analytics?.topTeamLead || 'Lead Tech'}</strong></p>
          </div>

          {/* Needing Improvement */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Needs Improvement</span>
              <AlertTriangle size={20} className="text-rose-500" />
            </div>
            <span className="text-3xl font-black text-rose-500">
              {analytics?.employeesNeedingImprovement?.length || 0}
            </span>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold">Staff requiring upskilling support</p>
          </div>

        </div>

        {/* ── Reports & Table Section ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider">
                {month} Report
              </span>
            </div>

            <div className="relative max-w-xs w-full">
              <input 
                type="text" 
                placeholder="Search staff, dept, grade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 pl-9 pr-3 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4 min-w-[200px]">Employee Profile</th>
                  <th className="py-3.5 px-4 min-w-[90px]">KPI Score</th>
                  {(isHR || isAdmin) && <th className="py-3.5 px-4 min-w-[160px]">HR Rating (1-10) & Remarks</th>}
                  {(isTeamLead || isAdmin) && <th className="py-3.5 px-4 min-w-[160px]">TL Rating (1-10) & Remarks</th>}
                  <th className="py-3.5 px-4 min-w-[180px]">Admin Rating (1-10) & Remarks</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Performance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {filteredReports.length > 0 ? (
                  filteredReports.map((row, idx) => {
                    const isSaving = savingRowId === row._id;
                    const isSaved = savedRowId === row._id;
                    return (
                      <tr key={row._id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        
                        {/* Employee Name & Profile Photo */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {row.avatar ? (
                                <img
                                  src={row.avatar}
                                  alt={row.employeeName}
                                  className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/20 shadow-xs"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs ring-2 ring-indigo-500/20">
                                  {row.employeeName?.[0]}
                                </div>
                              )}
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 ring-2 ring-white dark:ring-slate-900" />
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{row.employeeName}</span>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">{row.designation || 'Staff'} • {row.department}</span>
                            </div>
                          </div>
                        </td>

                        {/* Overall KPI Score */}
                        <td className="py-3.5 px-4">
                          {(() => {
                            const kpiColor = getKpiColorCode(row.kpiScore);
                            return (
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 dark:text-slate-100 text-xs">{row.kpiScore}%</span>
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" 
                                  style={{ backgroundColor: kpiColor.hex }}
                                  title={kpiColor.label}
                                />
                              </div>
                            );
                          })()}
                        </td>

                        {/* HR Rating & Remarks Column (HR or Admin only) */}
                        {(isHR || isAdmin) && (
                          <td className="py-3.5 px-4">
                            {isHR ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400">Rating:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={row.hrRating ?? 5}
                                    onChange={(e) => handleRowChange(idx, 'hrRating', Math.min(10, Math.max(1, parseFloat(e.target.value) || 1)))}
                                    className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-xs font-black text-indigo-600 dark:text-indigo-400 text-center"
                                  />
                                </div>
                                <input
                                  type="text"
                                  placeholder="HR remarks..."
                                  value={row.hrRemark || ''}
                                  onChange={(e) => handleRowChange(idx, 'hrRemark', e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium placeholder-slate-400"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400">HR Rating:</span>
                                  <span className="font-black text-indigo-600 dark:text-indigo-400">{row.hrRating ?? 'Not Rated'}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-[180px]">
                                  "{row.hrRemark || 'No remark'}"
                                </p>
                              </div>
                            )}
                          </td>
                        )}

                        {/* TL Rating & Remarks Column (Team Lead or Admin only) */}
                        {(isTeamLead || isAdmin) && (
                          <td className="py-3.5 px-4">
                            {isTeamLead ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400">Rating:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={row.tlRating ?? 5}
                                    onChange={(e) => handleRowChange(idx, 'tlRating', Math.min(10, Math.max(1, parseFloat(e.target.value) || 1)))}
                                    className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-xs font-black text-cyan-600 dark:text-cyan-400 text-center"
                                  />
                                </div>
                                <input
                                  type="text"
                                  placeholder="TL remarks..."
                                  value={row.tlRemark || ''}
                                  onChange={(e) => handleRowChange(idx, 'tlRemark', e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium placeholder-slate-400"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400">TL Rating:</span>
                                  <span className="font-black text-cyan-600 dark:text-cyan-400">{row.tlRating ?? 'Not Rated'}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-[180px]">
                                  "{row.tlRemark || 'No remark'}"
                                </p>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Admin Rating & Remarks Column (Editable for Admin, View-Only for HR & Team Lead) */}
                        <td className="py-3.5 px-4">
                          {isAdmin ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400">Rating:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={row.adminRating ?? 5}
                                  onChange={(e) => handleRowChange(idx, 'adminRating', Math.min(10, Math.max(1, parseFloat(e.target.value) || 1)))}
                                  className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-xs font-black text-amber-500 text-center"
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Admin remarks..."
                                value={row.adminRemark || ''}
                                onChange={(e) => handleRowChange(idx, 'adminRemark', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium placeholder-slate-400"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400">Admin Rating:</span>
                                <span className="font-black text-amber-500">{row.adminRating ?? 'Not Rated'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-[180px]">
                                "{row.adminRemark || 'No remark'}"
                              </p>
                            </div>
                          )}
                        </td>

                        {/* Performance Status Select Dropdown */}
                        <td className="py-3.5 px-4">
                          {isAdmin || isHR || isTeamLead ? (
                            <select
                              value={row.status || row.grade || 'Good'}
                              onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                              {row.status || row.grade || 'Good'}
                            </span>
                          )}

                          {isSaving && <span className="text-[9px] font-bold text-indigo-500 block mt-1 animate-pulse">Saving...</span>}
                          {isSaved && <span className="text-[9px] font-bold text-emerald-500 block mt-1">Saved! ✓</span>}
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 4} className="py-12 text-center text-slate-400">
                      No employee evaluation records discovered for {month}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};

export default PerformanceDashboard;
