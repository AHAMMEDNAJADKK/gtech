import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Loader2, Edit, Trash2, X,
  Clock, Users, Filter, ArrowUpDown, ChevronDown, Check,
  BookOpenCheck, ShieldCheck, Flame, Tag, Layers, CheckCircle2,
  BookOpen, Award, Target, LayoutGrid, List, Calendar, Link as LinkIcon,
  UserCheck, ExternalLink, Percent, MessageSquare, Award as ScoreIcon,
  PlayCircle, FileText, BarChart3, User
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import EmployeeMultiSelect from '../components/EmployeeMultiSelect';
import { fetchDepartments } from '../services/projectService';

const API_BASE = import.meta.env.VITE_API_URL;

const CATEGORIES = [
  'ALL',
  'General',
  'Onboarding & Induction',
  'HR & Policy',
  'Sales & CRM Skills',
  'Technical Training',
  'Design & Content',
  'Marketing & Digital',
  'Leadership & Management',
  'Compliance & Safety',
  'Accounts & Finance',
  'Occasional'
];

const STATUSES = ['ALL', 'ACTIVE', 'DRAFT', 'COMPLETED', 'INACTIVE'];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'name-asc', label: 'Name (A - Z)' },
  { id: 'name-desc', label: 'Name (Z - A)' }
];

/* Status Styling Map */
const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active',
    style: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 font-black',
    inlineStyle: { backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
    dot: 'bg-emerald-500 ring-2 ring-emerald-400/40',
    topBar: 'bg-emerald-500',
    cardBorder: 'border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-700'
  },
  DRAFT: {
    label: 'Draft',
    style: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 font-black',
    inlineStyle: { backgroundColor: '#ffedd5', color: '#c2410c', borderColor: '#fdba74' },
    dot: 'bg-orange-500 ring-2 ring-orange-400/40',
    topBar: 'bg-orange-700',
    cardBorder: 'border-orange-300 dark:border-orange-900/60 hover:border-orange-400 dark:hover:border-orange-700'
  },
  COMPLETED: {
    label: 'Completed',
    style: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 font-black',
    inlineStyle: { backgroundColor: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe' },
    dot: 'bg-indigo-500 ring-2 ring-indigo-400/40',
    topBar: 'bg-indigo-600',
    cardBorder: 'border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-400 dark:hover:border-indigo-700'
  },
  INACTIVE: {
    label: 'Inactive',
    style: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-black',
    inlineStyle: { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
    dot: 'bg-slate-500',
    topBar: 'bg-slate-400',
    cardBorder: 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
  }
};

const getStatusConfig = (statusStr) => {
  const key = String(statusStr || '').trim().toUpperCase();
  return STATUS_CONFIG[key] || STATUS_CONFIG.ACTIVE;
};

const EMPTY_FORM = {
  courseName: '',
  category: 'General',
  description: '',
  trainer: '',
  startDate: '',
  dueDate: '',
  materialsUrl: '',
  modules: [],
  durationValue: 1,
  durationUnit: 'Days',
  targetAudience: 'ALL',
  isMandatory: false,
  isOccasional: false,
  scheduledDate: '',
  status: 'ACTIVE',
  assignedEmployees: []
};

/* ─────────────── BEAUTIFUL COURSE CARD (GRID VIEW) ─────────────── */
const CourseCard = ({ course, handleStatusChange, openEdit, setDeleteTarget, updatingStatusId }) => {
  const statusConf = getStatusConfig(course.status);

  // Compute average completion % across assigned employees
  const progressList = course.employeeProgress || [];
  const avgProgress = progressList.length > 0
    ? Math.round(progressList.reduce((acc, curr) => acc + (curr.progressPercent || 0), 0) / progressList.length)
    : 0;

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group bg-white dark:bg-slate-900 border ${statusConf.cardBorder} rounded-[2.2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between overflow-hidden`}
    >
      {/* Top Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusConf.topBar}`} />

      <div>
        {/* Category & Status Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            <Tag size={10} className="text-indigo-500" /> {course.category}
          </span>

          <div className="relative">
            {updatingStatusId === course._id ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <Loader2 size={11} className="animate-spin text-indigo-500" /> ...
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${statusConf.dot}`} />
                <select
                  value={String(course.status || 'ACTIVE').toUpperCase()}
                  onChange={e => handleStatusChange(course._id, e.target.value)}
                  style={statusConf.inlineStyle}
                  className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border cursor-pointer outline-none appearance-none pr-6 shadow-xs transition-colors duration-200 ${statusConf.style}`}
                >
                  {STATUSES.filter(s => s !== 'ALL').map(s => (
                    <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-slate-900 dark:text-slate-100 font-black text-lg uppercase tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug mb-2">
          {course.courseName}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2 mb-3">
          {course.description || 'No course overview provided.'}
        </p>

        {/* Trainer & Dates Info */}
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold mb-3">
          {course.trainer && (
            <span className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 flex items-center gap-1">
              <User size={11} className="text-indigo-500" /> Trainer: {course.trainer}
            </span>
          )}
          {course.dueDate && (
            <span className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 flex items-center gap-1">
              <Calendar size={11} className="text-amber-500" /> Due: {new Date(course.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {course.materialsUrl && String(course.materialsUrl).trim() !== '' && String(course.materialsUrl).trim() !== '#' && (
            <a
              href={course.materialsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-200/50 flex items-center gap-1 hover:underline"
            >
              <LinkIcon size={11} /> Material
            </a>
          )}
        </div>

        {/* Badges */}
        {(course.isOccasional || course.isMandatory) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {course.isOccasional && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[9px] font-extrabold uppercase tracking-wider">
                <Flame size={12} className="text-purple-500" /> Occasional
              </span>
            )}
            {course.isMandatory && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[9px] font-extrabold uppercase tracking-wider">
                <ShieldCheck size={12} className="text-rose-500" /> Mandatory
              </span>
            )}
          </div>
        )}

        {/* Progress Bar & Meta Strip */}
        <div className="space-y-2 p-3.5 bg-slate-50/80 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Average Completion</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{avgProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${avgProgress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-500" />
              <span className="font-bold text-slate-700 dark:text-slate-200">{course.durationValue} {course.durationUnit}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Target size={13} className="text-indigo-500 shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{course.targetAudience}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        {/* Avatars */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2.5">
            {(course.assignedEmployees || []).slice(0, 3).map((emp, i) => (
              <div
                key={emp._id || i}
                title={emp.name}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-[10px] font-black flex items-center justify-center overflow-hidden shrink-0 shadow-xs"
              >
                {emp.avatar || emp.profile_image ? (
                  <img src={emp.avatar || emp.profile_image} alt={emp.name} className="w-full h-full object-cover" />
                ) : (
                  emp.name?.[0]?.toUpperCase()
                )}
              </div>
            ))}
            {(course.assignedEmployees || []).length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-black flex items-center justify-center shrink-0">
                +{(course.assignedEmployees || []).length - 3}
              </div>
            )}
          </div>
          <span className="text-[10px] font-black text-slate-400">
            {(course.assignedEmployees || []).length} staff
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openEdit(course)}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-indigo-50 text-slate-500 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-xs"
            title="Edit Course"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(course)}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer shadow-xs"
            title="Delete Course"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ─────────────── MAIN PAGE ─────────────── */
const EmployeeTrainingPage = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab]   = useState('catalog'); // 'catalog' | 'my-training' | 'records'
  const [courses, setCourses]         = useState([]);
  const [myCourses, setMyCourses]     = useState([]);
  const [stats, setStats]             = useState({ total: 0, active: 0, draft: 0, completed: 0, inactive: 0 });
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus]     = useState('ALL');
  const [sortBy, setSortBy]                 = useState('newest');
  const [viewMode, setViewMode]             = useState('grid');
  const [departments, setDepartments]      = useState([]);

  // Dropdowns
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSortOpen, setIsSortOpen]         = useState(false);

  const categoryRef = useRef(null);
  const sortRef     = useRef(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData]         = useState(EMPTY_FORM);
  const [moduleInput, setModuleInput]   = useState({ title: '', resourceUrl: '' });

  // Employee Progress Update Modal
  const [progressModalTarget, setProgressModalTarget] = useState(null); // { course, record }
  const [progressForm, setProgressForm]               = useState({ status: 'NOT_STARTED', progressPercent: 0, score: '', remarks: '' });
  const [isUpdatingProgress, setIsUpdatingProgress]   = useState(false);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setIsCategoryOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target)) setIsSortOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  /* ─── fetch all courses ─── */
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${apiBase()}/employee-training?search=${encodeURIComponent(searchQuery)}&status=${filterStatus}&category=${filterCategory}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setCourses(data.data || []);
        setStats(data.stats || { total: 0, active: 0, draft: 0, completed: 0, inactive: 0 });
      }
    } catch {
      showToast('Error loading courses.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterCategory, getHeaders, showToast]);

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

  /* ─── fetch my assigned courses ─── */
  const fetchMyCourses = useCallback(async () => {
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
      }
    } catch {
      // silently fail if user is unauthenticated
    }
  }, [getHeaders, getCurrentUserId]);

  useEffect(() => {
    fetchCourses();
    fetchMyCourses();
  }, [fetchCourses, fetchMyCourses]);

  useEffect(() => {
    fetchDepartments()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setDepartments(list.filter(d => d.status === true || d.status === 'active' || d.isActive === true || d.status === undefined));
      })
      .catch(() => {});
  }, []);

  const sortedCourses = [...courses].sort((a, b) => {
    if (sortBy === 'name-asc') return (a.courseName || '').localeCompare(b.courseName || '');
    if (sortBy === 'name-desc') return (b.courseName || '').localeCompare(a.courseName || '');
    if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const openAdd = () => {
    setEditingCourse(null);
    setFormData(EMPTY_FORM);
    setModuleInput({ title: '', resourceUrl: '' });
    setIsModalOpen(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      courseName:        course.courseName || '',
      category:          course.category || 'General',
      description:       course.description || '',
      trainer:           course.trainer || '',
      startDate:         course.startDate ? course.startDate.substring(0, 10) : '',
      dueDate:           course.dueDate ? course.dueDate.substring(0, 10) : '',
      materialsUrl:      course.materialsUrl || '',
      modules:           course.modules || [],
      durationValue:     course.durationValue || 1,
      durationUnit:      course.durationUnit || 'Days',
      targetAudience:    course.targetAudience || 'ALL',
      isMandatory:       course.isMandatory || false,
      isOccasional:      course.isOccasional || false,
      scheduledDate:     course.scheduledDate ? course.scheduledDate.substring(0, 10) : '',
      status:            String(course.status || 'ACTIVE').toUpperCase(),
      assignedEmployees: (course.assignedEmployees || []).map(e => e._id || e)
    });
    setModuleInput({ title: '', resourceUrl: '' });
    setIsModalOpen(true);
  };

  const addModule = () => {
    if (!moduleInput.title.trim()) return;
    setFormData(p => ({
      ...p,
      modules: [...p.modules, { title: moduleInput.title.trim(), resourceUrl: moduleInput.resourceUrl.trim() }]
    }));
    setModuleInput({ title: '', resourceUrl: '' });
  };

  const removeModule = (index) => {
    setFormData(p => ({ ...p, modules: p.modules.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseName.trim()) return showToast('Course name is required.', 'warning');
    setIsSubmitting(true);
    try {
      const endpoint = editingCourse ? `${apiBase()}/employee-training/${editingCourse._id}` : `${apiBase()}/employee-training`;
      const method = editingCourse ? 'PUT' : 'POST';
      const res = await fetch(endpoint, { method, headers: getHeaders(), body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        showToast(editingCourse ? 'Course updated.' : 'Course created.', 'success');
        setIsModalOpen(false);
        fetchCourses();
        fetchMyCourses();
      }
    } catch {
      showToast('Save failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (courseId, newStatus) => {
    const formattedStatus = String(newStatus).toUpperCase();
    setUpdatingStatusId(courseId);
    try {
      const res = await fetch(`${apiBase()}/employee-training/${courseId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: formattedStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status updated to ${formattedStatus}`, 'success');
        setCourses(prev => prev.map(c => c._id === courseId ? { ...c, status: formattedStatus } : c));
      }
    } catch {
      showToast('Update failed.', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  /* ── Open progress modal for employee record ── */
  const openProgressModal = (course, rec) => {
    setProgressModalTarget({ course, rec });
    setProgressForm({
      status: rec.status || 'NOT_STARTED',
      progressPercent: rec.progressPercent || 0,
      score: rec.score !== null && rec.score !== undefined ? rec.score : '',
      remarks: rec.remarks || ''
    });
  };

  const handleSaveEmployeeProgress = async (e) => {
    e.preventDefault();
    if (!progressModalTarget) return;
    setIsUpdatingProgress(true);
    try {
      const { course, rec } = progressModalTarget;
      const res = await fetch(`${apiBase()}/employee-training/${course._id}/progress`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          employeeId: rec.employeeId?._id || rec.employeeId,
          status: progressForm.status,
          progressPercent: progressForm.progressPercent,
          score: progressForm.score !== '' ? parseFloat(progressForm.score) : null,
          remarks: progressForm.remarks
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Employee training progress updated.', 'success');
        setProgressModalTarget(null);
        fetchCourses();
        fetchMyCourses();
      }
    } catch {
      showToast('Failed to update progress.', 'error');
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${apiBase()}/employee-training/${deleteTarget._id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        showToast('Course deleted.', 'success');
        setDeleteTarget(null);
        fetchCourses();
        fetchMyCourses();
      }
    } catch (err) {
      showToast('Delete failed.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const [completedModuleMap, setCompletedModuleMap] = useState({});
  const [updatingModuleKey, setUpdatingModuleKey]   = useState(null);

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
            ? `Module marked as Complete! Progress: ${newPercent}%`
            : `Module completion undone. Progress: ${newPercent}%`,
          'success'
        );
        fetchCourses();
        fetchMyCourses();
      } else {
        showToast(data.message || 'Failed to update module completion.', 'error');
      }
    } catch (err) {
      showToast('Error updating module completion.', 'error');
    } finally {
      setUpdatingModuleKey(null);
    }
  };

  const setField = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-24 pt-3 max-w-7xl mx-auto px-4 font-sans text-slate-700 dark:text-slate-200"
    >
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-[2rem] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
            <BookOpenCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Employee Training
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                {stats.active} Active Courses
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">KOD.BRAND Internal LMS & Continuous Employee Upskilling</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'}`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'}`}
              title="Table View"
            >
              <List size={15} />
            </button>
          </div>

          <button
            onClick={openAdd}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Course
          </button>
        </div>
      </div>

      {/* ── METRIC STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Catalog', value: stats.total, icon: BookOpen },
          { label: 'Active Programs', value: stats.active, icon: CheckCircle2 },
          { label: 'Completed Batches', value: stats.completed, icon: Award },
          { label: 'Draft & Pending', value: stats.draft + stats.inactive, icon: Layers }
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">{s.label}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{s.value}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800">
              <s.icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* ── NAVIGATION TABS (ALL CATALOG / MY LEARNING / STAFF RECORDS) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <BookOpen size={15} /> All Course Catalog
        </button>

        <button
          onClick={() => setActiveTab('my-training')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'my-training'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <PlayCircle size={15} /> My Learning LMS ({myCourses.length})
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'records'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <BarChart3 size={15} /> Staff Learning Records & Progress
        </button>
      </div>

      {/* ── TAB 1: ALL COURSE CATALOG ── */}
      {activeTab === 'catalog' && (
        <>
          {/* TOOLBAR WITH DROPDOWN BUTTONS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search courses by title, department, description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Category Dropdown */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setIsCategoryOpen(prev => !prev)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                    filterCategory !== 'ALL'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-500'
                  }`}
                >
                  <Filter size={14} />
                  <span>Category: <strong>{filterCategory}</strong></span>
                  <ChevronDown size={14} className={`transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCategoryOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1 max-h-64 overflow-y-auto">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setFilterCategory(cat);
                          setIsCategoryOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          filterCategory === cat ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{cat}</span>
                        {filterCategory === cat && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setIsSortOpen(prev => !prev)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-all cursor-pointer"
                >
                  <ArrowUpDown size={14} />
                  <span>Sort: <strong>{SORT_OPTIONS.find(o => o.id === sortBy)?.label}</strong></span>
                  <ChevronDown size={14} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id);
                          setIsSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          sortBy === opt.id ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MAIN DIRECTORY CONTENT */}
          {loading ? (
            <div className="py-24 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-indigo-600" size={20} /> Loading courses...
            </div>
          ) : sortedCourses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No courses match your query</p>
              <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs">
                <Plus size={14} /> Add Course
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedCourses.map(course => (
                <CourseCard
                  key={course._id}
                  course={course}
                  handleStatusChange={handleStatusChange}
                  openEdit={openEdit}
                  setDeleteTarget={setDeleteTarget}
                  updatingStatusId={updatingStatusId}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="p-4">Course Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Target Dept</th>
                    <th className="p-4">Assigned Staff</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedCourses.map(course => {
                    const statusConf = getStatusConfig(course.status);
                    return (
                      <tr key={course._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{course.courseName}</td>
                        <td className="p-4 text-slate-500 font-semibold">{course.category}</td>
                        <td className="p-4 text-slate-500">{course.durationValue} {course.durationUnit}</td>
                        <td className="p-4 text-slate-500 uppercase font-semibold">{course.targetAudience}</td>
                        <td className="p-4 text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-2">
                              {(course.assignedEmployees || []).slice(0, 3).map((emp, i) => (
                                <div key={emp._id || i} title={emp.name} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[8px] font-bold flex items-center justify-center overflow-hidden">
                                  {emp.avatar || emp.profile_image ? <img src={emp.avatar || emp.profile_image} alt="" className="w-full h-full object-cover" /> : emp.name?.[0]}
                                </div>
                              ))}
                            </div>
                            <span>{(course.assignedEmployees || []).length} staff</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={String(course.status || 'ACTIVE').toUpperCase()}
                            onChange={e => handleStatusChange(course._id, e.target.value)}
                            style={statusConf.inlineStyle}
                            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border outline-none cursor-pointer ${statusConf.style}`}
                          >
                            {STATUSES.filter(s => s !== 'ALL').map(s => (
                              <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(course)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 hover:text-indigo-600">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => setDeleteTarget(course)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 hover:text-rose-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: MY TRAINING LMS (EMPLOYEE ASSIGNED VIEW) ── */}
      {activeTab === 'my-training' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">My Assigned LMS Training</h3>
            <p className="text-xs text-slate-400">View your assigned upskilling courses, study materials, and update your learning progress.</p>
          </div>

          {myCourses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">You currently have no assigned training courses.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {myCourses.map(c => (
                <div key={c._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                        {c.category}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">{c.courseName}</h4>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.description || 'No description provided.'}</p>

                  {/* Modules / Links */}
                  {c.materialsUrl && String(c.materialsUrl).trim() !== '' && String(c.materialsUrl).trim() !== '#' && (
                    <a
                      href={c.materialsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline"
                    >
                      <LinkIcon size={14} /> Access Course Materials / Video Link
                    </a>
                  )}

                  {/* Syllabus Modules list */}
                  {(c.modules || []).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">Course Modules:</p>
                        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          {(completedModuleMap[c._id] || []).length} / {c.modules.length} Completed
                        </span>
                      </div>
                      {c.modules.map((m, idx) => {
                        const isDone = (completedModuleMap[c._id] || []).includes(idx);
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
                                <a href={m.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px] font-bold">
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

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Trainer: <strong className="text-slate-700 dark:text-slate-300">{c.trainer || 'Internal HR'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: STAFF LEARNING RECORDS & PROGRESS ── */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Employee- & Department-wise Learning Records</h3>
            <p className="text-xs text-slate-400">Monitor continuous staff completion %, assessment results, and trainer remarks.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="p-4">Course Name</th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Progress %</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Assessment / Score</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {courses.flatMap(c => (c.employeeProgress || []).map(rec => ({ course: c, rec }))).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">No staff learning progress records registered yet.</td>
                  </tr>
                ) : (
                  courses.flatMap(c => (c.employeeProgress || []).map(rec => ({ course: c, rec }))).map(({ course, rec }, i) => {
                    const emp = rec.employeeId || {};
                    const empName = emp.name || 'Assigned Staff';
                    const empDept = emp.department?.name || emp.department || 'N/A';

                    return (
                      <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{course.courseName}</td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 text-[10px] font-black flex items-center justify-center overflow-hidden">
                            {emp.avatar || emp.profile_image ? <img src={emp.avatar || emp.profile_image} alt="" className="w-full h-full object-cover" /> : empName[0]}
                          </div>
                          {empName}
                        </td>
                        <td className="p-4 text-slate-500 font-semibold uppercase">{empDept}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 w-28">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${rec.progressPercent || 0}%` }} />
                            </div>
                            <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">{rec.progressPercent || 0}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            rec.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                            rec.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {rec.status || 'NOT_STARTED'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                          {rec.score !== null && rec.score !== undefined ? `${rec.score} / 100` : '—'}
                        </td>
                        <td className="p-4 text-slate-500 italic max-w-[150px] truncate">{rec.remarks || '—'}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => openProgressModal(course, rec)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 hover:text-indigo-600 font-bold"
                          >
                            <Edit size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT COURSE CATALOG ── */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {editingCourse ? 'Edit Course' : 'Add New Training Course'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
                  {/* Course Title */}
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Course Title *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Fire Safety Refresher 2026"
                      value={formData.courseName}
                      onChange={e => setField('courseName', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-medium focus:border-indigo-500"
                    />
                  </div>

                  {/* Category & Trainer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Category</label>
                      <select
                        value={formData.category}
                        onChange={e => setField('category', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                      >
                        {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Trainer / Provider Name</label>
                      <input
                        type="text"
                        placeholder="e.g. John Doe / Internal HR"
                        value={formData.trainer}
                        onChange={e => setField('trainer', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Start Date, Due Date, Status */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={e => setField('startDate', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setField('dueDate', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setField('status', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                      >
                        {STATUSES.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Materials URL */}
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Course Materials Link / Drive URL</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={formData.materialsUrl}
                      onChange={e => setField('materialsUrl', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-medium"
                    />
                  </div>

                  {/* Duration & Target Dept */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Duration</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.durationValue}
                        onChange={e => setField('durationValue', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Unit</label>
                      <select
                        value={formData.durationUnit}
                        onChange={e => setField('durationUnit', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                      >
                        {['Hours', 'Days', 'Weeks', 'Months'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Target Dept</label>
                      <select
                        value={formData.targetAudience}
                        onChange={e => setField('targetAudience', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                      >
                        <option value="ALL">ALL Active Depts</option>
                        {departments.map(d => {
                          const name = d.name || d.department_name || '';
                          return <option key={d._id || name} value={name}>{name}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Mandatory Course</span>
                      <button
                        type="button"
                        onClick={() => setField('isMandatory', !formData.isMandatory)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${formData.isMandatory ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <span className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${formData.isMandatory ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Occasional Course</span>
                      <button
                        type="button"
                        onClick={() => setField('isOccasional', !formData.isOccasional)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${formData.isOccasional ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <span className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${formData.isOccasional ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Syllabus Modules Manager */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="font-semibold block text-slate-700 dark:text-slate-300">Syllabus Modules / Topics</label>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Module topic title"
                        value={moduleInput.title}
                        onChange={e => setModuleInput(p => ({ ...p, title: e.target.value }))}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 outline-none"
                      />
                      <input
                        type="url"
                        placeholder="Resource link (optional)"
                        value={moduleInput.resourceUrl}
                        onChange={e => setModuleInput(p => ({ ...p, resourceUrl: e.target.value }))}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 outline-none"
                      />
                      <button type="button" onClick={addModule} className="px-3 py-2 bg-indigo-600 text-white font-bold rounded-xl">
                        + Add
                      </button>
                    </div>

                    {formData.modules.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {formData.modules.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{idx + 1}. {m.title}</span>
                            <button type="button" onClick={() => removeModule(idx)} className="text-rose-500 hover:text-rose-700">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Outline learning objectives..."
                      value={formData.description}
                      onChange={e => setField('description', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none resize-none font-medium"
                    />
                  </div>

                  {/* Employee MultiSelect */}
                  <EmployeeMultiSelect
                    label="Assign Staff / Employees"
                    required={false}
                    selectedEmployeeIds={formData.assignedEmployees}
                    onChange={ids => setField('assignedEmployees', ids)}
                  />

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold cursor-pointer">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs">
                      {isSubmitting ? 'Saving...' : editingCourse ? 'Update' : 'Save'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── MODAL: UPDATE EMPLOYEE PROGRESS / ASSESSMENT ── */}
      {createPortal(
        <AnimatePresence>
          {progressModalTarget && (
            <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Update Learning Progress</h3>
                  <button onClick={() => setProgressModalTarget(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveEmployeeProgress} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Progress Status</label>
                    <select
                      value={progressForm.status}
                      onChange={e => setProgressForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-bold"
                    >
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                      Completion Percentage ({progressForm.progressPercent}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progressForm.progressPercent}
                      onChange={e => setProgressForm(p => ({ ...p, progressPercent: parseInt(e.target.value) || 0 }))}
                      className="w-full cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Assessment Score (0 - 100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g. 85"
                        value={progressForm.score}
                        onChange={e => setProgressForm(p => ({ ...p, score: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">Trainer / Assessment Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Excellent performance in practical fire drill assessment."
                      value={progressForm.remarks}
                      onChange={e => setProgressForm(p => ({ ...p, remarks: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none resize-none font-medium"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={() => setProgressModalTarget(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold cursor-pointer">
                      Cancel
                    </button>
                    <button type="submit" disabled={isUpdatingProgress} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer">
                      {isUpdatingProgress ? 'Saving...' : 'Save Progress'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">Delete Course?</h4>
                <p className="text-xs text-slate-500 mt-1">Are you sure you want to delete "{deleteTarget.courseName}"?</p>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer">Cancel</button>
                  <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer">Delete</button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default EmployeeTrainingPage;
