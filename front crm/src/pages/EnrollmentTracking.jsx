import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../components/Modal';
import { 
  GraduationCap, Plus, Search, LayoutGrid, List, ChevronRight, Loader2, 
  BookOpen, Users, CheckCircle2, Archive, Eye, Edit, X, FolderKanban,
  BarChart3, UserCheck, Clock, Percent, AlertCircle, Sparkles, Trash2
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const STATUSES = ['ALL', 'active', 'paused', 'completed', 'dropped'];

const initialEnrollmentForm = {
  studentId: '',
  batchId: '',
  status: 'active'
};

const EnrollmentTracking = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // SuperAdmin detection
  const isSuperAdmin = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return false;
      const u = JSON.parse(rawUser);
      const roleStr = String(u.role || '').toLowerCase();
      const roleIdStr = String(u.role_id || u.roleId || '');
      return Boolean(
        u.isSuperAdmin === true ||
        u.is_super_admin === true ||
        roleStr === 'superadmin' ||
        roleStr === 'super_admin' ||
        roleIdStr === '0' ||
        roleStr.includes('superadmin')
      );
    } catch (e) {
      return false;
    }
  }, []);

  const [enrollments, setEnrollments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEnrollments: 0, activeCount: 0, completedCount: 0, avgProgress: 0 });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table');

  // Create Enrollment Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [formData, setFormData] = useState(initialEnrollmentForm);

  // Quick Progress Update Modal State
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedEnrollmentForProgress, setSelectedEnrollmentForProgress] = useState(null);
  const [progressModules, setProgressModules] = useState(0);
  const [progressTotal, setProgressTotal] = useState(10);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  // Delete Enrollment Modal State (SuperAdmin Only)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, studentName: '', courseName: '' });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // 1. Fetch Enrollments Directory
  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments?search=${encodeURIComponent(searchQuery)}&courseId=${selectedCourseFilter}&batchId=${selectedBatchFilter}&status=${selectedStatusFilter}`
        : `${cleanBase}/v1/academy/enrollments?search=${encodeURIComponent(searchQuery)}&courseId=${selectedCourseFilter}&batchId=${selectedBatchFilter}&status=${selectedStatusFilter}`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load enrollment list.');

      const data = await res.json();
      const validEnrollments = (data.data || []).filter(e => {
        if (!e.studentId) return false;
        if (!e.studentId._id && !e.studentId.name) return false;
        const st = e.studentId;
        if (st.isDeleted === true || st.is_deleted === true || st.status === 'deleted' || st.status === 'inactive' || st.isActive === false) return false;
        return true;
      });
      setEnrollments(validEnrollments);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Fetch Enrollments Error:", err);
      showToast("Unable to fetch enrollment tracking directory.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCourseFilter, selectedBatchFilter, selectedStatusFilter, getHeaders, showToast]);

  // 2. Fetch Batches
  const fetchBatches = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches`
        : `${cleanBase}/v1/academy/batches`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBatches(data.data || []);
      }
    } catch (err) {
      console.error("Fetch Batches Error:", err);
    }
  }, [getHeaders]);

  // 3. Fetch Courses
  const fetchCourses = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/courses`
        : `${cleanBase}/v1/academy/courses`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.data || []);
      }
    } catch (err) {
      console.error("Fetch Courses Error:", err);
    }
  }, [getHeaders]);

  // 4. Fetch Registered Students
  const fetchRegisteredStudents = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/users?role=student&limit=500`
        : `${cleanBase}/v1/users?role=student&limit=500`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const studentUsers = data?.users || data?.data?.users || data?.data || [];
        const activeStudents = studentUsers.filter(s => {
          if (!s) return false;
          if (s.isDeleted === true || s.is_deleted === true || s.status === 'deleted' || s.status === 'inactive' || s.isActive === false) return false;
          return true;
        });
        setRegisteredStudents(activeStudents);
      }
    } catch (err) {
      console.error("Fetch Registered Students Error:", err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  useEffect(() => {
    fetchBatches();
    fetchCourses();
    fetchRegisteredStudents();
  }, [fetchBatches, fetchCourses, fetchRegisteredStudents]);

  const handleOpenCreateModal = () => {
    setFormData(initialEnrollmentForm);
    setIsCreateModalOpen(true);
  };

  const handleOpenProgressModal = (enrollment) => {
    setSelectedEnrollmentForProgress(enrollment);
    setProgressModules(enrollment.completedModules || 0);
    setProgressTotal(enrollment.totalModules || 10);
    setIsProgressModalOpen(true);
  };

  const handleSubmitCreateEnrollment = async (e) => {
    e.preventDefault();
    setIsSubmittingCreate(true);

    if (!formData.studentId) {
      showToast('Please select a registered student.', 'warning');
      setIsSubmittingCreate(false);
      return;
    }

    if (!formData.batchId) {
      showToast('Please select a batch for enrollment.', 'warning');
      setIsSubmittingCreate(false);
      return;
    }

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments`
        : `${cleanBase}/v1/academy/enrollments`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        fetchEnrollments();
        showToast("Student enrolled successfully!", "success");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || errData.error || "Failed to create enrollment.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSubmitUpdateProgress = async (e) => {
    e.preventDefault();
    if (!selectedEnrollmentForProgress) return;
    setIsSubmittingProgress(true);

    try {
      const enrollmentId = selectedEnrollmentForProgress._id || selectedEnrollmentForProgress.id;
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments/${enrollmentId}/progress`
        : `${cleanBase}/v1/academy/enrollments/${enrollmentId}/progress`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          completedModules: progressModules,
          totalModules: progressTotal
        })
      });

      if (res.ok) {
        setIsProgressModalOpen(false);
        fetchEnrollments();
        showToast("Course progress updated successfully!", "success");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || errData.error || "Failed to update progress.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  const handleOpenDeleteModal = (enrollment) => {
    const studentName = enrollment.studentId?.name || 'Student Account';
    const courseName = enrollment.courseId?.courseName || 'Enrolled Course';
    setDeleteConfirm({
      isOpen: true,
      id: enrollment._id || enrollment.id,
      studentName,
      courseName
    });
  };

  const handleConfirmDeleteEnrollment = async () => {
    const { id } = deleteConfirm;
    if (!id) return;
    setIsSubmittingDelete(true);

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments/${id}`
        : `${cleanBase}/v1/academy/enrollments/${id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        setDeleteConfirm({ isOpen: false, id: null, studentName: '', courseName: '' });
        showToast("Enrollment record deleted successfully!", "success");
        fetchEnrollments();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || errData.error || errData.detail || "Failed to delete enrollment.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Selected batch in Create modal to display derived course name
  const selectedModalBatchObj = batches.find(b => String(b._id || b.id) === String(formData.batchId));
  const derivedModalCourseName = selectedModalBatchObj?.courseId?.courseName || 'Course will be derived automatically from selected Batch';

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-10 pb-24 pt-4 max-w-7xl mx-auto px-4 font-sans text-slate-600 dark:text-slate-200 transition-colors duration-300"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tighter">
            <span className="text-indigo-600 dark:text-indigo-400">Enrollment</span> & Progress
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Student Academic Enrollments, Course Progress & Attendance Integration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button 
              onClick={() => setViewMode('table')} 
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${viewMode === 'table' ? 'bg-indigo-700 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-700 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <button 
            onClick={handleOpenCreateModal} 
            className="px-6 py-3.5 rounded-2xl bg-indigo-700 text-white shadow-md shadow-indigo-600/20 font-black text-[10px] uppercase tracking-wider transition-all hover:bg-indigo-600 cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} /> Enroll Student in Batch
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Enrollments', value: stats.totalEnrollments, icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400', border: 'bg-indigo-600', sub: 'Student Batch Enrollments' },
          { label: 'Active Students', value: stats.activeCount, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', border: 'bg-emerald-500', sub: 'Currently Active' },
          { label: 'Completed Enrollments', value: stats.completedCount, icon: Sparkles, color: 'text-purple-600 dark:text-purple-400', border: 'bg-purple-600', sub: '100% Progress Closed' },
          { label: 'Average Course Progress', value: `${stats.avgProgress}%`, icon: BarChart3, color: 'text-amber-600 dark:text-amber-400', border: 'bg-amber-500', sub: 'Academy Aggregate' }
        ].map((s, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/50 p-6 rounded-[2rem] relative overflow-hidden group shadow-sm hover:shadow-md transition-all hover:border-slate-350 dark:hover:border-slate-700">
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${s.border}`} />
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-1">{s.label}</p>
                <h3 className={`text-3xl font-black italic tracking-tight ${s.color}`}>{s.value}</h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-450 font-bold uppercase tracking-wide">{s.sub}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800/60 transition-all duration-300 group-hover:scale-110">
                <s.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Controls & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by student name, ID, course or batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 placeholder:font-semibold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">Course: All Courses</option>
            {courses.map(c => (
              <option key={c._id || c.id} value={c._id || c.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">{c.courseName}</option>
            ))}
          </select>

          <select
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">Batch: All Batches</option>
            {batches.map(b => (
              <option key={b._id || b.id} value={b._id || b.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">{b.batchName}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            {STATUSES.map(s => (
              <option key={s} value={s} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Status: {s.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Views */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={44} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Loading Student Enrollments...</p>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-16 text-center shadow-sm">
          <GraduationCap className="mx-auto text-slate-400 mb-4 opacity-50" size={48} />
          <h3 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">No Student Enrollments Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto font-medium">
            No student enrollments match your current search parameters. Enroll registered students into course batches to start progress tracking.
          </p>
          <button 
            onClick={handleOpenCreateModal}
            className="mt-6 px-6 py-3 rounded-2xl bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider cursor-pointer inline-flex items-center gap-2"
          >
            <Plus size={14} /> Enroll Student Now
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'table' ? (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student ID & Name</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course & Batch</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course Progress</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance History</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map(e => {
                      const enrollmentId = e._id || e.id;
                      const student = e.studentId || {};
                      const course = e.courseId || {};
                      const batch = e.batchId || {};
                      const att = e.attendanceSummary || {};

                      return (
                        <tr key={enrollmentId} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="px-6 py-5 cursor-pointer" onClick={() => navigate(`/academy/enrollments/${enrollmentId}`)}>
                            <div className="flex items-center gap-3">
                              {student.profile_image ? (
                                <img src={student.profile_image} alt={student.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800/40">
                                  {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                              )}
                              <div>
                                <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 block mb-0.5">
                                  {student.studentId || 'STU'}
                                </span>
                                <p className="text-slate-900 dark:text-slate-100 font-bold text-sm uppercase tracking-tight hover:text-indigo-600">
                                  {student.name || 'Student Account'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                              {course.courseName || 'Course'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              Batch: {batch.batchName || 'N/A'}
                            </p>
                          </td>
                          <td className="px-6 py-5 min-w-[180px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span className="text-slate-500">Modules {e.completedModules || 0}/{e.totalModules || 10}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{e.progressPercentage || 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, Math.max(0, e.progressPercentage || 0))}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 min-w-[180px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span className="text-slate-500">{att.presentCount || 0}/{att.totalSessions || 0} Sessions</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{att.attendancePercentage || 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, Math.max(0, att.attendancePercentage || 0))}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              e.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              e.status === 'completed' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                              e.status === 'paused' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                              'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => navigate(`/academy/enrollments/${enrollmentId}`)}
                                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
                                title="View Enrollment Details"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => handleOpenProgressModal(e)}
                                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
                                title="Update Course Progress"
                              >
                                <BarChart3 size={15} />
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleOpenDeleteModal(e)}
                                  className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
                                  title="Delete Enrollment (SuperAdmin Only)"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map(e => {
                const enrollmentId = e._id || e.id;
                const student = e.studentId || {};
                const course = e.courseId || {};
                const batch = e.batchId || {};
                const att = e.attendanceSummary || {};

                return (
                  <motion.div 
                    key={enrollmentId}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 rounded-[2.5rem] hover:shadow-md transition-all relative flex flex-col justify-between shadow-sm space-y-6"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                          {student.studentId || 'STU'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          e.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          e.status === 'completed' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                          'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {e.status}
                        </span>
                      </div>

                      {/* Student Info & Batch */}
                      <div className="cursor-pointer" onClick={() => navigate(`/academy/enrollments/${enrollmentId}`)}>
                        <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xl leading-tight uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                          {student.name || 'Student Account'}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          {course.courseName || 'Course'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                          Batch: {batch.batchName || 'N/A'}
                        </p>
                      </div>

                      {/* Dual Metrics Bars */}
                      <div className="mt-6 space-y-4 p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-slate-400">Course Progress</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{e.progressPercentage || 0}% ({e.completedModules}/{e.totalModules})</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${e.progressPercentage || 0}%` }} />
                          </div>
                        </div>

                        {/* Attendance */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-slate-400">Attendance</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{att.attendancePercentage || 0}% ({att.presentCount}/{att.totalSessions})</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${att.attendancePercentage || 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/academy/enrollments/${enrollmentId}`)}
                        className="flex-1 py-3 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                      >
                        <Eye size={13} /> View Details
                      </button>
                      <button
                        onClick={() => handleOpenProgressModal(e)}
                        className="p-3 bg-white dark:bg-slate-950 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                        title="Update Progress"
                      >
                        <BarChart3 size={14} />
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleOpenDeleteModal(e)}
                          className="p-3 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900/50"
                          title="Delete Enrollment (SuperAdmin Only)"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Create Enrollment Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          <span>
            Enroll Registered <span className="text-indigo-600">Student</span>
          </span>
        }
        subtitle="Select registered student and batch (Course is derived automatically)"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmitCreateEnrollment} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Registered Student *</label>
            <select
              required
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Select Student</option>
              {registeredStudents.map(st => (
                <option key={st._id || st.id} value={st._id || st.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                  {st.name} ({st.studentId || 'STU'}) — {st.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Batch *</label>
            <select
              required
              value={formData.batchId}
              onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Select Batch</option>
              {batches.map(b => (
                <option key={b._id || b.id} value={b._id || b.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                  {b.batchName} ({b.batchCode}) — Course: {b.courseId?.courseName || 'Course'}
                </option>
              ))}
            </select>
          </div>

          {/* Automatically Derived Course Display */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
            <span className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Derived Course</span>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
              {derivedModalCourseName}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {isSubmittingCreate ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Create Enrollment
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Progress Update Modal */}
      <Modal
        isOpen={Boolean(isProgressModalOpen && selectedEnrollmentForProgress)}
        onClose={() => setIsProgressModalOpen(false)}
        title={
          <span>
            Update <span className="text-indigo-600">Course Progress</span>
          </span>
        }
        subtitle={selectedEnrollmentForProgress ? `${selectedEnrollmentForProgress.studentId?.name} • ${selectedEnrollmentForProgress.courseId?.courseName}` : ''}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmitUpdateProgress} className="space-y-6">
          <div className="space-y-3 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300">Completed Modules</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {progressModules} / {progressTotal} ({Math.round((progressModules / Math.max(1, progressTotal)) * 100)}%)
              </span>
            </div>

            <input
              type="range"
              min="0"
              max={progressTotal}
              value={progressModules}
              onChange={(e) => setProgressModules(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
            />

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400">Completed Modules</label>
                <input
                  type="number"
                  min="0"
                  max={progressTotal}
                  value={progressModules}
                  onChange={(e) => setProgressModules(Math.min(progressTotal, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400">Total Curriculum Modules</label>
                <input
                  type="number"
                  min="1"
                  value={progressTotal}
                  onChange={(e) => setProgressTotal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              className="px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingProgress}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {isSubmittingProgress ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Save Progress
            </button>
          </div>
        </form>
      </Modal>

      {/* SuperAdmin Delete Enrollment Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteConfirm.isOpen)}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, studentName: '', courseName: '' })}
        title="Delete Enrollment Record?"
        maxWidth="max-w-md"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-800/60">
              <Trash2 size={28} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                Are you sure you want to permanently delete the enrollment of <span className="font-black text-slate-900 dark:text-slate-100">{deleteConfirm.studentName}</span> in course <span className="font-black text-indigo-600">{deleteConfirm.courseName}</span>?
              </p>
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-2 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-xl border border-rose-200/50 dark:border-rose-900/40">
                ⚠️ Action restricted to SuperAdmin users.
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, id: null, studentName: '', courseName: '' })}
              className="flex-1 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteEnrollment}
              disabled={isSubmittingDelete}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
            >
              {isSubmittingDelete ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Delete Record
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default EnrollmentTracking;
