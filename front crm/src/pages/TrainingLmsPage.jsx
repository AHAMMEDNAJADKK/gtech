import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Search, Loader2, Clock, Check, CheckCircle2,
  BookOpen, Calendar, Link as LinkIcon, ExternalLink, Filter, Sparkles, User
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const STATUSES = ['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];

const TrainingLmsPage = () => {
  const { showToast } = useToast();

  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [completedModuleMap, setCompletedModuleMap] = useState({});
  const [updatingModuleKey, setUpdatingModuleKey] = useState(null);

  const getHeaders = useCallback(() => {
    const raw = localStorage.getItem('token');
    const token = raw ? raw.replace(/"/g, '') : '';
    return {
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const apiBase = () => {
    const base = (API_BASE || '/api').replace(/\/$/, '');
    return base.endsWith('/v1') ? base : `${base}/v1`;
  };

  const getCurrentUserId = useCallback(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const id = parsed?._id || parsed?.id || parsed?.user?._id || parsed?.user?.id || parsed?.data?._id || parsed?.data?.id || null;
      return id ? String(id) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchMyCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/employee-training/my-training`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        setMyCourses(list);

        const currentUserId = getCurrentUserId();
        const userStr = localStorage.getItem('user');
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const currentEmail = currentUser?.email || currentUser?.user?.email;

        // Initialize completed modules map based on saved progress
        const initMap = {};
        list.forEach(c => {
          let rec = (c.employeeProgress || []).find(p => {
            const empId = p.employeeId?._id || p.employeeId;
            return empId && currentUserId && String(empId) === String(currentUserId);
          });

          if (!rec && currentEmail) {
            rec = (c.employeeProgress || []).find(p => p.employeeId?.email === currentEmail);
          }
          if (!rec) {
            rec = (c.employeeProgress || [])[0];
          }

          if (rec && Array.isArray(rec.completedModules)) {
            initMap[c._id] = rec.completedModules;
          } else {
            initMap[c._id] = [];
          }
        });
        setCompletedModuleMap(prev => ({ ...initMap, ...prev }));
      } else {
        showToast('Unable to load assigned training courses.', 'error');
      }
    } catch {
      showToast('Error connecting to training server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, getCurrentUserId, showToast]);

  useEffect(() => {
    fetchMyCourses();
  }, [fetchMyCourses]);

  const handleToggleModuleComplete = async (course, moduleIdx) => {
    const courseId = course._id;
    const moduleKey = `${courseId}_${moduleIdx}`;
    setUpdatingModuleKey(moduleKey);

    try {
      const currentDone = completedModuleMap[courseId] || [];
      const isDone = currentDone.includes(moduleIdx);
      const newDone = isDone
        ? currentDone.filter(i => i !== moduleIdx)
        : [...currentDone, moduleIdx];

      const totalModules = (course.modules || []).length;
      const newPercent = totalModules > 0 ? Math.round((newDone.length / totalModules) * 100) : 100;
      const newStatus = newPercent === 100 ? 'COMPLETED' : (newPercent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED');

      // Update state locally immediately
      setCompletedModuleMap(prev => ({ ...prev, [courseId]: newDone }));

      const currentUserId = getCurrentUserId();
      const res = await fetch(`${apiBase()}/employee-training/${courseId}/progress`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          employeeId: currentUserId,
          completedModules: newDone,
          progressPercent: newPercent,
          status: newStatus
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          !isDone
            ? `Module marked as Complete! Course progress: ${newPercent}%`
            : `Module completion undone. Course progress: ${newPercent}%`,
          'success'
        );
        fetchMyCourses();
      } else {
        showToast(data.message || 'Failed to update module completion.', 'error');
      }
    } catch {
      showToast('Error updating module completion.', 'error');
    } finally {
      setUpdatingModuleKey(null);
    }
  };

  const filteredCourses = myCourses.filter(c => {
    const query = searchQuery.toLowerCase().trim();
    const matchSearch = !query ||
      (c.courseName || '').toLowerCase().includes(query) ||
      (c.description || '').toLowerCase().includes(query) ||
      (c.category || '').toLowerCase().includes(query) ||
      (c.trainer || '').toLowerCase().includes(query);

    if (!matchSearch) return false;

    if (statusFilter !== 'ALL') {
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const currentUserId = currentUser?._id || currentUser?.id;
      const rec = (c.employeeProgress || []).find(p => {
        const empId = p.employeeId?._id || p.employeeId;
        return empId && currentUserId && String(empId) === String(currentUserId);
      }) || (c.employeeProgress || [])[0];

      const recStatus = rec?.status || 'NOT_STARTED';
      if (statusFilter === 'NOT_STARTED' && recStatus !== 'NOT_STARTED') return false;
      if (statusFilter === 'IN_PROGRESS' && recStatus !== 'IN_PROGRESS') return false;
      if (statusFilter === 'COMPLETED' && recStatus !== 'COMPLETED') return false;
    }

    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-24 pt-3 max-w-7xl mx-auto px-4 font-sans text-slate-700 dark:text-slate-200"
    >
      {/* ── HEADER BANNER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 rounded-[2.2rem] shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <GraduationCap size={14} /> Training LMS • KOD.BRAND Learning System
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              My Training & Development
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
              Access your internal upskilling courses, study resources, video modules, and mark syllabus items as complete to track your continuous progress.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shrink-0">
            <BookOpen size={28} className="text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Total Enrolled Courses</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{myCourses.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTERS & SEARCH STRIP ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search my training courses..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Filter size={13} /> Filter Status:
          </span>
          {STATUSES.map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ── COURSE CARDS GRID ── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Training LMS Courses...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <GraduationCap size={44} className="mx-auto text-slate-300 dark:text-slate-700" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">No Training Courses Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No courses match your current search or status filter.'
              : 'You have not been assigned any internal training courses yet. Please check back later or contact HR.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCourses.map(c => {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const currentUserId = currentUser?._id || currentUser?.id;
            const rec = (c.employeeProgress || []).find(p => {
              const empId = p.employeeId?._id || p.employeeId;
              return empId && currentUserId && String(empId) === String(currentUserId);
            }) || (c.employeeProgress || [])[0] || {};

            const doneIndices = completedModuleMap[c._id] || [];
            const totalModules = (c.modules || []).length;
            const progressPct = totalModules > 0 ? Math.round((doneIndices.length / totalModules) * 100) : (rec.progressPercent || 0);

            return (
              <div
                key={c._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] p-6 space-y-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300"
              >
                <div className="space-y-4">
                  {/* Category & Status Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900">
                      {c.category}
                    </span>

                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      progressPct === 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                      progressPct > 0 ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300' :
                      'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {progressPct === 100 ? 'COMPLETED' : progressPct > 0 ? 'IN PROGRESS' : 'NOT STARTED'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                      {c.courseName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                      {c.description || 'No course overview provided.'}
                    </p>
                  </div>

                  {/* Progress Meter Bar */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Course Progress</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta Strip: Trainer & Dates */}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-semibold">
                    {c.trainer && (
                      <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <User size={11} className="text-indigo-500" /> Trainer: {c.trainer}
                      </span>
                    )}
                    {c.dueDate && (
                      <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Calendar size={11} className="text-amber-500" /> Due: {new Date(c.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    {c.materialsUrl && String(c.materialsUrl).trim() !== '' && String(c.materialsUrl).trim() !== '#' && (
                      <a
                        href={c.materialsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:underline font-bold"
                      >
                        <LinkIcon size={11} /> Course Material / Video Link
                      </a>
                    )}
                  </div>

                  {/* Syllabus Modules List with COMPLETE Button */}
                  {(c.modules || []).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">Course Modules:</p>
                        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          {doneIndices.length} / {c.modules.length} Completed
                        </span>
                      </div>

                      {c.modules.map((m, idx) => {
                        const isDone = doneIndices.includes(idx);
                        const isUpdating = updatingModuleKey === `${c._id}_${idx}`;

                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {isDone ? <Check size={12} /> : idx + 1}
                              </span>
                              <span className={`font-semibold text-xs truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {m.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {m.resourceUrl && String(m.resourceUrl).trim() !== '' && String(m.resourceUrl).trim() !== '#' && (
                                <a
                                  href={m.resourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px] font-bold"
                                >
                                  Resource <ExternalLink size={12} />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => handleToggleModuleComplete(c, idx)}
                                disabled={isUpdating}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                }`}
                              >
                                {isUpdating ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : isDone ? (
                                  <>
                                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /> Completed
                                  </>
                                ) : (
                                  <>
                                    <Check size={12} /> Complete
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default TrainingLmsPage;
